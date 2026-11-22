-- ============================================================================
-- U-MARKET: BLINDAJE INTEGRAL DE SEGURIDAD (RLS, TRIGGERS, RPCs Y STORAGE)
-- ============================================================================
-- Ejecutar en el SQL Editor de Supabase (es idempotente y seguro de re-ejecutar).
-- Cierra:
--   1. Escalación de privilegios en public.profiles (role, is_verified, is_active, etc.)
--   2. Auto-aprobación y manipulación de campos protegidos en public.listings
--   3. Bypass de auth.uid() NULL en bump_listing y exposición de get_weekly_stats
--   4. Políticas abiertas en storage.objects (buckets avatars y listings)
--   5. Consistencia de columnas académicas (faculty, semester) en profiles y handle_new_user
-- ============================================================================

-- ── 1. Garantizar columnas esperadas en profiles y listings ──
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS faculty text,
  ADD COLUMN IF NOT EXISTS semester text,
  ADD COLUMN IF NOT EXISTS rating_avg numeric(3, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS review_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS credential_url text,
  ADD COLUMN IF NOT EXISTS verification_rejected_reason text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_submitted_at timestamptz;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS bumped_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_urgent boolean DEFAULT false;

-- ── 2. Reforzar protección PII en profiles ──
REVOKE SELECT (phone, email) ON public.profiles FROM anon, authenticated;

-- ── 3. Políticas UPDATE estrictas en profiles (con WITH CHECK) ──
DROP POLICY IF EXISTS "Usuario actualiza su propio perfil" ON public.profiles;
CREATE POLICY "Usuario actualiza su propio perfil"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Admins actualizan todos los perfiles" ON public.profiles;
CREATE POLICY "Admins actualizan todos los perfiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
    )
  );

-- Trigger BEFORE UPDATE en profiles: bloquea escalación de privilegios y fraude de reputación
CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_caller_role text;
BEGIN
  -- service_role, postgres y funciones SECURITY DEFINER internas pasan sin restricción
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  SELECT p.role INTO v_caller_role
  FROM public.profiles p
  WHERE p.id = (SELECT auth.uid());

  -- Solo administradores pueden modificar columnas privilegiadas de usuarios
  IF v_caller_role = 'admin' THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.role IS DISTINCT FROM OLD.role
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
     OR NEW.verification_status IS DISTINCT FROM OLD.verification_status
     OR NEW.credential_url IS DISTINCT FROM OLD.credential_url
     OR NEW.verification_rejected_reason IS DISTINCT FROM OLD.verification_rejected_reason
     OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
     OR NEW.verification_submitted_at IS DISTINCT FROM OLD.verification_submitted_at
     OR NEW.rating_avg IS DISTINCT FROM OLD.rating_avg
     OR NEW.review_count IS DISTINCT FROM OLD.review_count
     OR NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'No tienes permiso para modificar campos protegidos del perfil'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_profile_sensitive_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_profile_sensitive_columns ON public.profiles;
CREATE TRIGGER trg_guard_profile_sensitive_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_sensitive_columns();

-- ── 4. Políticas UPDATE estrictas y trigger de integridad en listings ──
DROP POLICY IF EXISTS "Vendedor edita sus publicaciones" ON public.listings;
CREATE POLICY "Vendedor edita sus publicaciones"
  ON public.listings FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = seller_id)
  WITH CHECK ((SELECT auth.uid()) = seller_id);

CREATE OR REPLACE FUNCTION public.guard_listing_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_caller_role text;
  v_caller_active boolean;
  v_require_approval boolean := false;
  v_content_changed boolean := false;
BEGIN
  -- service_role, postgres y RPCs SECURITY DEFINER internas (bump_listing, increment_listing_views)
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  SELECT p.role, COALESCE(p.is_active, false)
  INTO v_caller_role, v_caller_active
  FROM public.profiles p
  WHERE p.id = (SELECT auth.uid());

  -- Administradores y moderadores pueden moderar estados y campos libremente
  IF v_caller_role IN ('admin', 'moderator') THEN
    RETURN NEW;
  END IF;

  IF NOT COALESCE(v_caller_active, false) THEN
    RAISE EXCEPTION 'Tu cuenta está suspendida y no puede crear ni editar publicaciones'
      USING ERRCODE = '42501';
  END IF;

  -- Al insertar: forzar valores iniciales seguros en servidor (evita bumped_at futuro, is_featured o views falsas)
  IF TG_OP = 'INSERT' THEN
    NEW.is_featured := false;
    NEW.views := 0;
    NEW.report_count := 0;
    NEW.bumped_at := now();

    IF NEW.status = 'removed' THEN
      RAISE EXCEPTION 'Estado de publicación no válido al crear'
        USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  -- Al actualizar: impedir manipulación de dueño, destacados, bumps, vistas y reportes
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.seller_id IS DISTINCT FROM OLD.seller_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.is_featured IS DISTINCT FROM OLD.is_featured
     OR NEW.bumped_at IS DISTINCT FROM OLD.bumped_at
     OR NEW.views IS DISTINCT FROM OLD.views
     OR NEW.report_count IS DISTINCT FROM OLD.report_count THEN
    RAISE EXCEPTION 'No tienes permiso para modificar campos protegidos de la publicación'
      USING ERRCODE = '42501';
  END IF;

  -- Un vendedor nunca puede reactivar una publicación eliminada por moderación
  IF OLD.status = 'removed' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'No puedes reactivar una publicación eliminada por moderación'
      USING ERRCODE = '42501';
  END IF;

  -- Un vendedor nunca puede auto-aprobar una publicación pendiente
  IF OLD.status = 'pending_approval' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Solo un administrador o moderador puede aprobar esta publicación'
      USING ERRCODE = '42501';
  END IF;

  -- Un vendedor solo puede alternar entre active y paused (o enviar a pending_approval)
  IF NEW.status = 'removed' AND OLD.status <> 'removed' THEN
    RAISE EXCEPTION 'Usa la opción de eliminar para borrar tu publicación'
      USING ERRCODE = '42501';
  END IF;

  -- Si la moderación previa está activada, editar contenido obliga a pasar por pending_approval
  SELECT EXISTS (
    SELECT 1 FROM public.platform_settings
    WHERE key = 'listings_require_approval' AND value = 'true'::jsonb
  ) INTO v_require_approval;

  v_content_changed :=
    NEW.title IS DISTINCT FROM OLD.title
    OR NEW.description IS DISTINCT FROM OLD.description
    OR NEW.price IS DISTINCT FROM OLD.price
    OR NEW.category IS DISTINCT FROM OLD.category
    OR NEW.image_url IS DISTINCT FROM OLD.image_url
    OR NEW.whatsapp_number IS DISTINCT FROM OLD.whatsapp_number;

  IF v_require_approval AND v_content_changed AND NEW.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Las publicaciones editadas requieren aprobación previa'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_listing_write() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_listing_write ON public.listings;
CREATE TRIGGER trg_guard_listing_write
  BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_listing_write();

-- ── 5. Endurecer RPCs SECURITY DEFINER (search_path + validación estricta de auth.uid() y roles) ──

-- 5.1 bump_listing: corrige bypass cuando auth.uid() es NULL y verifica cuenta activa
CREATE OR REPLACE FUNCTION public.bump_listing(target_listing_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_seller_id uuid;
  v_last_bump timestamptz;
  v_is_verified boolean;
  v_is_active boolean;
  v_now timestamptz := now();
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado');
  END IF;

  SELECT l.seller_id, COALESCE(l.bumped_at, l.created_at), COALESCE(p.is_verified, false), COALESCE(p.is_active, false)
  INTO v_seller_id, v_last_bump, v_is_verified, v_is_active
  FROM public.listings l
  LEFT JOIN public.profiles p ON p.id = l.seller_id
  WHERE l.id = target_listing_id AND l.status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Publicación no encontrada o inactiva');
  END IF;

  IF v_caller_id IS DISTINCT FROM v_seller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'No tienes permiso para actualizar esta publicación');
  END IF;

  IF NOT v_is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tu cuenta está suspendida');
  END IF;

  IF NOT v_is_verified THEN
    RETURN jsonb_build_object('success', false, 'error', 'Debes verificar tu carnet estudiantil para usar la función de subir al inicio');
  END IF;

  IF (v_now - v_last_bump) < interval '24 hours' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Debes esperar 24 horas entre cada reactivación',
      'next_available', (v_last_bump + interval '24 hours')
    );
  END IF;

  UPDATE public.listings
  SET bumped_at = v_now, updated_at = v_now
  WHERE id = target_listing_id;

  RETURN jsonb_build_object('success', true, 'bumped_at', v_now);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bump_listing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bump_listing(uuid) TO authenticated;

-- 5.2 increment_listing_views: fija search_path y limita a anuncios activos
CREATE OR REPLACE FUNCTION public.increment_listing_views(listing_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.listings
  SET views = COALESCE(views, 0) + 1
  WHERE id = listing_id AND status = 'active';
$$;

REVOKE EXECUTE ON FUNCTION public.increment_listing_views(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_listing_views(uuid) TO authenticated;

-- 5.3 get_weekly_stats: restringir solo a admin y moderadores
CREATE OR REPLACE FUNCTION public.get_weekly_stats()
RETURNS TABLE (
  day date,
  new_listings bigint,
  new_users bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'moderator')
  ) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH dates AS (
    SELECT generate_series(
      current_date - interval '6 days',
      current_date,
      '1 day'::interval
    )::date AS d
  )
  SELECT
    dates.d AS day,
    (
      SELECT COALESCE(COUNT(*), 0)::bigint
      FROM public.listings l
      WHERE date_trunc('day', l.created_at)::date = dates.d
    ) AS new_listings,
    (
      SELECT COALESCE(COUNT(*), 0)::bigint
      FROM public.profiles p
      WHERE date_trunc('day', p.created_at)::date = dates.d
    ) AS new_users
  FROM dates
  ORDER BY dates.d ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_weekly_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_weekly_stats() TO authenticated;

-- 5.4 handle_new_user: reconciliar email, phone, faculty y semester
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, faculty, semester, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    NULLIF(NEW.raw_user_meta_data->>'faculty', ''),
    NULLIF(NEW.raw_user_meta_data->>'semester', ''),
    'buyer'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ── 6. Endurecer políticas de Storage (evita sobrescribir archivos ajenos) ──
DROP POLICY IF EXISTS "Usuario autenticado sube su avatar" ON storage.objects;
DROP POLICY IF EXISTS "Usuario autenticado actualiza su avatar" ON storage.objects;
DROP POLICY IF EXISTS "Usuario sube su propio avatar" ON storage.objects;
DROP POLICY IF EXISTS "Usuario actualiza su propio avatar" ON storage.objects;
DROP POLICY IF EXISTS "Usuario elimina su propio avatar" ON storage.objects;

CREATE POLICY "Usuario sube su propio avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Usuario actualiza su propio avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Usuario elimina su propio avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Usuario autenticado sube imagenes" ON storage.objects;
DROP POLICY IF EXISTS "Usuario sube sus propias imagenes" ON storage.objects;
DROP POLICY IF EXISTS "Usuario elimina sus imagenes" ON storage.objects;

CREATE POLICY "Usuario sube sus propias imagenes"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'listings'
    AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Usuario elimina sus imagenes"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'listings'
    AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
  );

UPDATE storage.buckets
SET
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'avatars';
