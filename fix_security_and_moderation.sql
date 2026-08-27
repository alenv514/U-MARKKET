-- =========================================================
-- U-MARKET: MIGRACIÓN DE SEGURIDAD, MODERACIÓN Y ATOMICIDAD
-- =========================================================
-- INSTRUCCIONES:
-- 1. Abre tu panel en https://supabase.com
-- 2. Ve a "SQL Editor" en el menú izquierdo
-- 3. Pega TODO este contenido y presiona "Run"
-- =========================================================

-- 1. Ampliar restricción de roles para admitir 'moderator'
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('buyer', 'seller', 'moderator', 'admin'));

-- 2. Actualizar políticas RLS de listings para Moderadores
DROP POLICY IF EXISTS "Admin gestiona todos los listings" ON public.listings;
DROP POLICY IF EXISTS "Admin y Moderadores gestionan todos los listings" ON public.listings;

CREATE POLICY "Admin y Moderadores gestionan todos los listings"
  ON public.listings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- 3. Actualizar políticas RLS de reportes para Moderadores
DROP POLICY IF EXISTS "Admin ve todos los reportes" ON public.reports;
DROP POLICY IF EXISTS "Admin y Moderadores ven todos los reportes" ON public.reports;

CREATE POLICY "Admin y Moderadores ven todos los reportes"
  ON public.reports FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- 4. Actualizar políticas RLS de admin_actions para Moderadores
DROP POLICY IF EXISTS "Admins gestionan admin_actions" ON public.admin_actions;
DROP POLICY IF EXISTS "Admins y Moderadores gestionan admin_actions" ON public.admin_actions;

CREATE POLICY "Admins y Moderadores gestionan admin_actions"
  ON public.admin_actions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- 5. Función RPC para incremento atómico de vistas
CREATE OR REPLACE FUNCTION public.increment_listing_views(listing_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.listings
  SET views = COALESCE(views, 0) + 1
  WHERE id = listing_id;
$$;
