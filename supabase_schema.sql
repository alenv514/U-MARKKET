-- =============================================
-- U-Market — Esquema de Base de Datos Supabase
-- Universidad Técnica de Ambato
-- =============================================
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en supabase.com
-- 2. Click en "SQL Editor" en el menú izquierdo
-- 3. Pega TODO este contenido y haz click en "Run"
-- =============================================

-- ─────────────────────────────────────────────
-- 1. PERFILES DE USUARIO
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text,
  phone       text,
  avatar_url  text,
  role        text NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer', 'seller', 'moderator', 'admin')),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 2. SUSCRIPCIONES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan       text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'paid')),
  starts_at  timestamptz NOT NULL DEFAULT now(),
  ends_at    timestamptz,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 3. PUBLICACIONES (LISTINGS)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.listings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title            text NOT NULL,
  description      text,
  price            numeric(10, 2) NOT NULL CHECK (price >= 0 AND price <= 100000),
  category         text NOT NULL DEFAULT 'Otros',
  image_url        text,
  whatsapp_number  text,
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'removed')),
  report_count     int NOT NULL DEFAULT 0,
  views            int NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 4. REPORTES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id   uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  reporter_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason       text NOT NULL,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, reporter_id)
);

-- ─────────────────────────────────────────────
-- 5. TRIGGER — Auto-crear perfil al registrarse
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Insertar usuario como 'buyer' por defecto con sus datos académicos
  INSERT INTO public.profiles (id, full_name, role, faculty, semester, phone)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 
    'buyer',
    NEW.raw_user_meta_data->>'faculty',
    NEW.raw_user_meta_data->>'semester',
    NEW.raw_user_meta_data->>'phone'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────
-- 6. TRIGGER — Auto-actualizar updated_at
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger LANGUAGE plpgsql
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_listings_updated_at
  BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─────────────────────────────────────────────
-- 7. ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "Perfiles visibles para todos los autenticados"
  ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Usuario actualiza su propio perfil"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins actualizan todos los perfiles"
  ON public.profiles FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- SUBSCRIPTIONS
CREATE POLICY "Usuario ve su propia suscripcion"
  ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin ve todas las suscripciones"
  ON public.subscriptions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- LISTINGS
CREATE POLICY "Listings activos visibles para todos"
  ON public.listings FOR SELECT USING (status = 'active');
CREATE POLICY "Vendedor ve todas sus publicaciones"
  ON public.listings FOR SELECT USING (auth.uid() = seller_id);
CREATE POLICY "Vendedor crea publicaciones segun suscripcion o modo libre"
  ON public.listings FOR INSERT
  WITH CHECK (
    auth.uid() = seller_id AND
    (
      EXISTS (
        SELECT 1 FROM public.subscriptions
        WHERE user_id = auth.uid() AND is_active = true
          AND (ends_at IS NULL OR ends_at > now())
      )
      OR
      EXISTS (
        SELECT 1 FROM public.platform_settings
        WHERE key = 'free_publishing_mode' AND value = 'true'::jsonb
      )
    )
  );
CREATE POLICY "Vendedor edita sus publicaciones"
  ON public.listings FOR UPDATE USING (auth.uid() = seller_id);
CREATE POLICY "Vendedor elimina sus publicaciones"
  ON public.listings FOR DELETE USING (auth.uid() = seller_id);
CREATE POLICY "Admin y Moderadores gestionan todos los listings"
  ON public.listings FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator')));

-- REPORTS
CREATE POLICY "Usuario autenticado puede reportar"
  ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Admin y Moderadores ven todos los reportes"
  ON public.reports FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator')));

-- ─────────────────────────────────────────────
-- 8. STORAGE — Bucket para imagenes de productos
-- ─────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('listings', 'listings', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Imagenes visibles para todos"
  ON storage.objects FOR SELECT USING (bucket_id = 'listings');
CREATE POLICY "Usuario autenticado sube imagenes"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'listings' AND auth.role() = 'authenticated');
CREATE POLICY "Usuario elimina sus imagenes"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'listings' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ─────────────────────────────────────────────
-- 9. STORAGE — Bucket para avatares de perfil
-- ─────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatares visibles para todos"
  ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Usuario sube su propio avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Usuario actualiza su propio avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Usuario elimina su propio avatar"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ─────────────────────────────────────────────
-- 10. FUNCIONES RPC (GDPR - Eliminar Cuenta)
-- ─────────────────────────────────────────────
-- Esta función permite a un usuario eliminar su propia cuenta desde el cliente.
-- Al usar SECURITY DEFINER, la función se ejecuta con privilegios de administrador
-- pero está estrictamente limitada al ID del usuario que la invoca (auth.uid()).
-- Debido a los ON DELETE CASCADE en las tablas, esto borrará todos sus datos.
CREATE OR REPLACE FUNCTION public.delete_user()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- Eliminar al usuario de la tabla de autenticación nativa
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- ─────────────────────────────────────────────
-- 11. AUDITORÍA ADMIN (admin_actions)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_actions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action      text NOT NULL,
  target_id   text, -- Puede ser un UUID de usuario, o 'global'
  details     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins y Moderadores gestionan admin_actions"
  ON public.admin_actions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator')));

-- ─────────────────────────────────────────────
-- 12. CONFIGURACIÓN GLOBAL (platform_settings)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Todos pueden leer la configuración pública (ej. para saber si hay publicación libre)
CREATE POLICY "Configuración visible para todos"
  ON public.platform_settings FOR SELECT USING (true);

CREATE POLICY "Solo admins actualizan configuración"
  ON public.platform_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Insertar configuración inicial por defecto (publicación libre = false)
INSERT INTO public.platform_settings (key, value)
VALUES ('free_publishing_mode', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────
-- 13. ESTADÍSTICAS SEMANALES (Checkpoint 3)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_weekly_stats()
RETURNS TABLE (
  day date,
  new_listings bigint,
  new_users bigint
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH dates AS (
    SELECT generate_series(
      current_date - interval '6 days', 
      current_date, 
      '1 day'::interval
    )::date as d
  )
  SELECT 
    dates.d as day,
    COUNT(DISTINCT l.id) as new_listings,
    COUNT(DISTINCT p.id) as new_users
  FROM dates
  LEFT JOIN public.listings l ON date_trunc('day', l.created_at)::date = dates.d
  LEFT JOIN public.profiles p ON date_trunc('day', p.created_at)::date = dates.d
  GROUP BY dates.d
  ORDER BY dates.d ASC;
END;
$$;

-- ─────────────────────────────────────────────
-- 14. VERIFICACIÓN DE ESTUDIANTES UTA Y APP SETTINGS
-- ─────────────────────────────────────────────
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS credential_url text,
  ADD COLUMN IF NOT EXISTS verification_rejected_reason text,
  ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS verification_submitted_at timestamp with time zone;

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read app_settings" ON public.app_settings;
CREATE POLICY "Public read app_settings"
  ON public.app_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admin modify app_settings" ON public.app_settings;
CREATE POLICY "Admin modify app_settings"
  ON public.app_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

INSERT INTO public.app_settings (key, value)
VALUES ('student_verification_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

