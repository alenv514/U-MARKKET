-- ============================================================
-- U-MARKET: FIX RLS PII + MODERACIÓN + CHAT + PUSH + REGISTRO
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================

-- ── 1. PROTEGER PII (phone, email) EN profiles ──
-- Oculta phone/email de cualquier lectura directa vía PostgREST.
-- El dueño usa get_own_contact(); el panel admin usa service role.
REVOKE SELECT (phone, email) ON public.profiles FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_own_contact()
RETURNS TABLE (phone text, email text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.phone, p.email
  FROM public.profiles p
  WHERE p.id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_own_contact() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_own_contact() TO authenticated;

-- ── 2. LISTINGS: impedir bypass de moderación y de baneo ──
DROP POLICY IF EXISTS "Vendedor crea publicaciones segun suscripcion o modo libre" ON public.listings;

CREATE POLICY "Vendedor crea publicaciones segun suscripcion o modo libre"
  ON public.listings FOR INSERT
  WITH CHECK (
    auth.uid() = seller_id
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active IS TRUE
    )
    AND (
      EXISTS (
        SELECT 1 FROM public.subscriptions
        WHERE user_id = auth.uid() AND is_active = true
          AND (ends_at IS NULL OR ends_at > now())
      )
      OR EXISTS (
        SELECT 1 FROM public.platform_settings
        WHERE key = 'free_publishing_mode' AND value = 'true'::jsonb
      )
    )
    AND (
      NOT EXISTS (
        SELECT 1 FROM public.platform_settings
        WHERE key = 'listings_require_approval' AND value = 'true'::jsonb
      )
      OR status = 'pending_approval'
    )
  );

-- ── 3. CHAT: permitir eliminar conversaciones y actualizar updated_at ──
CREATE OR REPLACE FUNCTION public.update_chat_timestamp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.chats SET updated_at = now() WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_chat_timestamp() FROM PUBLIC;

CREATE POLICY "Participantes eliminan sus chats"
  ON public.chats FOR DELETE
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Participantes eliminan mensajes de sus chats"
  ON public.messages FOR DELETE
  USING (
    auth.uid() = sender_id
    OR EXISTS (
      SELECT 1 FROM public.chats
      WHERE id = messages.chat_id
        AND (buyer_id = auth.uid() OR seller_id = auth.uid())
    )
  );

-- ── 4. PUSH: permitir UPDATE para que el upsert funcione ──
CREATE POLICY "Users can update their own push subscriptions"
  ON public.push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 5. Restringir increment_listing_views a autenticados ──
REVOKE EXECUTE ON FUNCTION public.increment_listing_views(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_listing_views(uuid) TO authenticated;

-- ── 6. Persistir phone en el perfil al registrarse ──
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL),
    'buyer'
  );
  RETURN NEW;
END;
$$;
