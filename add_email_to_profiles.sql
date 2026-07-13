-- =============================================
-- AGREGAR COLUMNA DE CORREO A LOS PERFILES
-- =============================================
-- Ejecuta esto en el SQL Editor de tu Supabase.
-- Permitirá buscar a las personas por su correo desde el panel de administración.

-- 1. Agregar la columna si no existe
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- 2. Copiar los correos existentes de auth.users a public.profiles
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id;

-- 3. Actualizar la función trigger para que guarde el correo al registrar nuevos usuarios
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email, 'buyer');

  RETURN NEW;
END;
$$;
