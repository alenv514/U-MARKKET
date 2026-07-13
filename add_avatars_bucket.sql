-- =============================================
-- Crear Bucket para Avatares de Usuario
-- =============================================
-- INSTRUCCIONES:
-- Ejecuta este script en el SQL Editor de tu proyecto en Supabase
-- =============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Seguridad (RLS) para el bucket 'avatars'
CREATE POLICY "Imagenes de perfil visibles para todos"
  ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Usuario autenticado sube su avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Usuario autenticado actualiza su avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Usuario elimina su propio avatar"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
