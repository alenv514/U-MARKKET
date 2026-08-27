-- ============================================================
-- U-MARKET: EXIGIR INTERACCIÓN PREVIA (CHAT) ANTES DE CALIFICAR
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================
-- Evita el "review bombing": un usuario ya no puede calificar a otro
-- sin haber tenido una conversación previa en la plataforma.

DROP POLICY IF EXISTS "Usuarios autenticados crean reseñas" ON public.reviews;

CREATE POLICY "Usuarios autenticados crean reseñas"
  ON public.reviews FOR INSERT
  WITH CHECK (
    auth.uid() = reviewer_id
    AND EXISTS (
      SELECT 1 FROM public.chats
      WHERE (buyer_id = auth.uid() AND seller_id = reviewee_id)
         OR (buyer_id = reviewee_id AND seller_id = auth.uid())
    )
  );
