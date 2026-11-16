-- ==============================================================================
-- U-MARKET UTA: Módulo de Visibilidad, Bumps y Recompensas Estudiantiles
-- ==============================================================================

-- 1. Columnas para visibilidad acelerada y ofertas del día
ALTER TABLE public.listings 
  ADD COLUMN IF NOT EXISTS bumped_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_urgent boolean DEFAULT false;

-- Si existen publicaciones antiguas, inicializar bumped_at con su fecha de creación
UPDATE public.listings 
SET bumped_at = created_at 
WHERE bumped_at IS NULL;

-- 2. Índice optimizado para ordenamiento del feed principal
CREATE INDEX IF NOT EXISTS idx_listings_feed_order 
  ON public.listings (status, is_featured DESC, bumped_at DESC, created_at DESC);

-- 3. Función segura para reactivar/subir publicación (Bump con cooldown de 24h)
CREATE OR REPLACE FUNCTION public.bump_listing(target_listing_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_seller_id uuid;
  v_last_bump timestamptz;
  v_is_verified boolean;
  v_now timestamptz := now();
BEGIN
  -- Obtener información de la publicación
  SELECT l.seller_id, COALESCE(l.bumped_at, l.created_at), COALESCE(p.is_verified, false)
  INTO v_seller_id, v_last_bump, v_is_verified
  FROM public.listings l
  LEFT JOIN public.profiles p ON p.id = l.seller_id
  WHERE l.id = target_listing_id AND l.status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Publicación no encontrada o inactiva');
  END IF;

  -- Validar que quien ejecuta sea el dueño de la publicación
  IF auth.uid() != v_seller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'No tienes permiso para actualizar esta publicación');
  END IF;

  -- Validar que el estudiante tenga perfil verificado para usar Bump
  IF NOT v_is_verified THEN
    RETURN jsonb_build_object('success', false, 'error', 'Debes verificar tu carnet estudiantil para usar la función de subir al inicio');
  END IF;

  -- Validar cooldown de 24 horas
  IF (v_now - v_last_bump) < interval '24 hours' THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Debes esperar 24 horas entre cada reactivación',
      'next_available', (v_last_bump + interval '24 hours')
    );
  END IF;

  -- Actualizar bumped_at
  UPDATE public.listings
  SET bumped_at = v_now, updated_at = v_now
  WHERE id = target_listing_id;

  RETURN jsonb_build_object('success', true, 'bumped_at', v_now);
END;
$$;
