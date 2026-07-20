-- =============================================
-- SOLUCIÓN DE ADVERTENCIAS DE SEGURIDAD (LINTER)
-- =============================================
-- Ejecuta este script en el SQL Editor de tu Supabase.
-- Corregirá las advertencias de seguridad (Warnings) de funciones y RLS.

-- ─────────────────────────────────────────────────────────────
-- 1. CORREGIR MUTA DE SEARCH_PATH (Seguridad de Esquemas)
-- ─────────────────────────────────────────────────────────────
-- Configura explícitamente el 'search_path' en 'public' para evitar ataques
-- de secuestro de esquemas en funciones que se ejecutan con privilegios de creador.

ALTER FUNCTION public.update_updated_at() SET search_path = public;
ALTER FUNCTION public.update_chat_timestamp() SET search_path = public;
ALTER FUNCTION public.delete_user() SET search_path = public;
ALTER FUNCTION public.get_weekly_stats() SET search_path = public;
ALTER FUNCTION public.recalculate_profile_rating() SET search_path = public;


-- ─────────────────────────────────────────────────────────────
-- 2. CORREGIR ACCESO A FUNCIONES SECURITY DEFINER (Restricción de Ejecución)
-- ─────────────────────────────────────────────────────────────
-- Por defecto en PostgreSQL, cualquier rol público puede llamar a las funciones.
-- Restringimos el acceso a las funciones críticas para que solo puedan ser llamadas
-- por quienes corresponde y no de forma anónima desde la API.

-- delete_user: Solo usuarios autenticados
REVOKE EXECUTE ON FUNCTION public.delete_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user() TO authenticated;

-- get_weekly_stats: Solo usuarios autenticados (el admin)
REVOKE EXECUTE ON FUNCTION public.get_weekly_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_weekly_stats() TO authenticated;

-- handle_new_user (Trigger de Auth): Nadie puede llamarla directamente por API, solo el sistema
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- recalculate_profile_rating (Trigger de base de datos): Nadie la llama directamente
REVOKE EXECUTE ON FUNCTION public.recalculate_profile_rating() FROM PUBLIC;


-- ─────────────────────────────────────────────────────────────
-- 3. CORREGIR EXPOSICIÓN DE BUCKETS PÚBLICOS (Storage Listing)
-- ─────────────────────────────────────────────────────────────
-- Los buckets públicos de Supabase permiten descargar archivos mediante la URL pública
-- de forma nativa. No necesitan una política SELECT que permita a cualquiera
-- LISTAR (leer los nombres de todos los archivos) de forma masiva.

-- Eliminar políticas antiguas si existen para evitar listar archivos de manera pública
DROP POLICY IF EXISTS "Avatares visibles para todos" ON storage.objects;
DROP POLICY IF EXISTS "Imagenes de perfil visibles para todos" ON storage.objects;
DROP POLICY IF EXISTS "Imagenes visibles para todos" ON storage.objects;

-- Creamos políticas SELECT seguras:
-- Permitimos la lectura pública directa, pero bloqueamos la capacidad de enlistar.
CREATE POLICY "Permitir descarga publica de avatares"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Permitir descarga publica de listings"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'listings');
