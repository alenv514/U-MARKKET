-- =============================================
-- CONFIGURACIÓN DE MODERACIÓN Y CENSURA
-- =============================================
-- Ejecuta este script en el SQL Editor de Supabase para activar el soporte
-- de estados de aprobación en tu base de datos.

-- 1. Eliminar la restricción antigua de estados si existe
ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_status_check;

-- 2. Agregar la nueva restricción que admite 'pending_approval' (pendiente de aprobación)
ALTER TABLE public.listings ADD CONSTRAINT listings_status_check 
  CHECK (status IN ('active', 'paused', 'removed', 'pending_approval'));

-- 3. Crear el valor de configuración en platform_settings
-- Por defecto se creará en TRUE (activado) tal como se solicitó, para que requiera aprobación.
INSERT INTO public.platform_settings (key, value)
VALUES ('listings_require_approval', 'true'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = 'true'::jsonb;
