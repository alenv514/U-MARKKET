-- =============================================
-- LIMITAR TAMAÑO Y FORMATO DE IMÁGENES EN STORAGE (ANTI-TROLLS)
-- =============================================
-- Ejecuta este script en el SQL Editor de tu Supabase.
-- Limita el tamaño máximo por archivo a 5MB y restringe el formato solo a imágenes (JPG, PNG, WEBP, GIF).

UPDATE storage.buckets
SET 
  file_size_limit = 10485760, -- 10 MB máximo por archivo (10 * 1024 * 1024)
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id IN ('listings', 'avatars');
