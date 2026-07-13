-- =============================================
-- Módulo de Reputación (Calificaciones / Estrellas)
-- =============================================

-- 1. Agregar columnas a profiles para "cachear" el promedio y no saturar la base de datos
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rating_avg numeric(3, 2) DEFAULT 0.00;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS review_count int DEFAULT 0;

-- 2. Crear tabla de reseñas
CREATE TABLE IF NOT EXISTS public.reviews (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewee_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating       int NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment      text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  -- Evitar que la misma persona califique al mismo vendedor más de 1 vez
  UNIQUE (reviewer_id, reviewee_id),
  -- Evitar auto-calificaciones
  CONSTRAINT no_self_review CHECK (reviewer_id != reviewee_id)
);

-- 3. Row Level Security (RLS) para reviews
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reseñas visibles para todos"
  ON public.reviews FOR SELECT USING (true);

CREATE POLICY "Usuarios autenticados crean reseñas"
  ON public.reviews FOR INSERT
  WITH CHECK (auth.uid() = reviewer_id);

CREATE POLICY "Usuarios actualizan sus propias reseñas"
  ON public.reviews FOR UPDATE
  USING (auth.uid() = reviewer_id);

CREATE POLICY "Usuarios eliminan sus propias reseñas"
  ON public.reviews FOR DELETE
  USING (auth.uid() = reviewer_id);

-- 4. Trigger para recalcular el promedio cada vez que se inserta, actualiza o borra una reseña
CREATE OR REPLACE FUNCTION public.recalculate_profile_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  target_user_id uuid;
  new_avg numeric;
  new_count int;
BEGIN
  -- Identificar a quién pertenece la reseña afectada
  IF TG_OP = 'DELETE' THEN
    target_user_id := OLD.reviewee_id;
  ELSE
    target_user_id := NEW.reviewee_id;
  END IF;

  -- Calcular nuevos valores
  SELECT COALESCE(AVG(rating), 0), COUNT(id)
  INTO new_avg, new_count
  FROM public.reviews
  WHERE reviewee_id = target_user_id;

  -- Actualizar el caché en el perfil
  UPDATE public.profiles
  SET rating_avg = ROUND(new_avg, 2),
      review_count = new_count
  WHERE id = target_user_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS on_review_change ON public.reviews;
CREATE TRIGGER on_review_change
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_profile_rating();

-- 5. Trigger para actualizar el updated_at de la reseña
CREATE TRIGGER set_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
