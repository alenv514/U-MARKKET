-- =========================================================
-- MIGRACIÓN: SISTEMA DE VERIFICACIÓN DE ESTUDIANTES UTA
-- =========================================================

-- 1. Agregar columnas de verificación a la tabla profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS credential_url text,
  ADD COLUMN IF NOT EXISTS verification_rejected_reason text,
  ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS verification_submitted_at timestamp with time zone;

-- Validar estados permitidos para verification_status
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_verification_status_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_verification_status_check
      CHECK (verification_status IN ('none', 'pending', 'approved', 'rejected'));
  END IF;
END $$;

-- 2. Crear tabla de configuraciones globales de la aplicación (Feature Flags)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS en app_settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Política de lectura pública/autenticada
DROP POLICY IF EXISTS "Public read app_settings" ON public.app_settings;
CREATE POLICY "Public read app_settings"
  ON public.app_settings FOR SELECT
  USING (true);

-- Política de modificación solo para administradores
DROP POLICY IF EXISTS "Admin modify app_settings" ON public.app_settings;
CREATE POLICY "Admin modify app_settings"
  ON public.app_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- 3. Inicializar el flag de verificación estudiantil (por defecto desactivado hasta el lanzamiento)
INSERT INTO public.app_settings (key, value)
VALUES ('student_verification_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;
