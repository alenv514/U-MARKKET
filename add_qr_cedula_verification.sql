-- ============================================================================
-- U-MARKET: VERIFICACIÓN POR QR DE CREDENCIAL UTA Y UNICIDAD POR CÉDULA HASH
-- ============================================================================
-- Ejecutar en el SQL Editor de Supabase (idempotente y seguro de re-ejecutar).
-- Protege contra duplicidad de cuentas usando HMAC-SHA256 (sin guardar cédulas
-- en texto plano, cumpliendo minimización de datos LOPDP).
-- ============================================================================

-- 1. Columna para el hash criptográfico único de la cédula
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cedula_hash text;

-- 2. Índice único parcial: impide dos cuentas confirmadas/verificadas con la misma cédula
CREATE UNIQUE INDEX IF NOT EXISTS profiles_cedula_hash_unique
  ON public.profiles (cedula_hash)
  WHERE cedula_hash IS NOT NULL;

-- 3. Ocultar cedula_hash de consultas públicas/autenticadas directas (solo backend service_role)
REVOKE SELECT (cedula_hash) ON public.profiles FROM anon, authenticated;

-- 4. Reforzar guard_profile_sensitive_columns() para bloquear alteración de cedula_hash desde cliente
CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_caller_role text;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  SELECT p.role INTO v_caller_role
  FROM public.profiles p
  WHERE p.id = (SELECT auth.uid());

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
     OR NEW.cedula_hash IS DISTINCT FROM OLD.cedula_hash
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
