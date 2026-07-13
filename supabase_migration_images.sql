-- Ejecutar en Supabase SQL Editor para agregar soporte de múltiples imágenes
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}';
