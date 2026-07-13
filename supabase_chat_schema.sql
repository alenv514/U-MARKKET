-- =============================================
-- U-Market — Esquema de Chat Interno
-- =============================================
-- INSTRUCCIONES:
-- Ejecuta este script en el SQL Editor de Supabase
-- IMPORTANTE: Después de ejecutar, ve a "Database" -> "Replication" en Supabase 
-- y asegúrate de habilitar la replicación para la tabla "messages" 
-- para que funcione el Realtime.
-- =============================================

-- 1. Tabla de Chats (Conversaciones)
CREATE TABLE IF NOT EXISTS public.chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(listing_id, buyer_id, seller_id) -- Evita chats duplicados para el mismo producto y par de usuarios
);

-- 2. Tabla de Mensajes
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Trigger para actualizar el updated_at de la tabla chats
CREATE OR REPLACE FUNCTION public.update_chat_timestamp()
RETURNS trigger LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.chats SET updated_at = now() WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_message_created ON public.messages;
CREATE TRIGGER on_message_created
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_chat_timestamp();

-- 4. Políticas RLS para Chats
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios ven sus propios chats"
  ON public.chats FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Compradores pueden crear chats"
  ON public.chats FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

-- 5. Políticas RLS para Mensajes
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios ven mensajes de sus chats"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chats 
      WHERE id = messages.chat_id 
      AND (buyer_id = auth.uid() OR seller_id = auth.uid())
    )
  );

CREATE POLICY "Usuarios pueden enviar mensajes a sus chats"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.chats 
      WHERE id = chat_id 
      AND (buyer_id = auth.uid() OR seller_id = auth.uid())
    )
  );

CREATE POLICY "Receptores pueden marcar como leído"
  ON public.messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.chats 
      WHERE id = messages.chat_id 
      AND (buyer_id = auth.uid() OR seller_id = auth.uid())
    )
    AND auth.uid() != sender_id -- Solo el que recibe puede marcar leído
  );
