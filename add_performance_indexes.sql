-- ============================================================================
-- U-Market — Script de Optimización e Índices de Alto Rendimiento para la UTA
-- ============================================================================
-- INSTRUCCIONES:
-- 1. Abre el panel de tu proyecto en Supabase (supabase.com).
-- 2. Dirígete a la sección "SQL Editor" en el menú lateral izquierdo.
-- 3. Pega todo el contenido de este archivo y presiona el botón "Run".
-- ============================================================================

-- 1. Habilitar extensión pg_trgm para búsquedas de texto instantáneas
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Índices de catálogo y alimentación principal (Feed)
-- Acelera drásticamente la consulta por defecto: .eq('status', 'active').order('created_at', { ascending: false })
CREATE INDEX IF NOT EXISTS idx_listings_feed_status_created 
  ON public.listings(status, created_at DESC);

-- Acelera el filtrado por categorías dentro de productos activos
CREATE INDEX IF NOT EXISTS idx_listings_feed_category 
  ON public.listings(status, category, created_at DESC);

-- Acelera la búsqueda de publicaciones por vendedor (Dashboard y Perfil)
CREATE INDEX IF NOT EXISTS idx_listings_seller_id 
  ON public.listings(seller_id);

-- 3. Índice GIN para búsquedas de texto con operadores LIKE / ILIKE
-- Convierte las búsquedas lentas de texto completo en búsquedas indexadas en memoria
CREATE INDEX IF NOT EXISTS idx_listings_trgm_search 
  ON public.listings USING gin (title gin_trgm_ops, category gin_trgm_ops);

-- 4. Índices para el sistema de mensajería y chats
-- Acelera la carga de la bandeja de entrada para compradores y vendedores
CREATE INDEX IF NOT EXISTS idx_chats_buyer_updated 
  ON public.chats(buyer_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_chats_seller_updated 
  ON public.chats(seller_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_chats_listing_id 
  ON public.chats(listing_id);

-- Acelera la carga de mensajes dentro de una conversación
CREATE INDEX IF NOT EXISTS idx_messages_chat_created 
  ON public.messages(chat_id, created_at ASC);

-- Índice parcial para conteo ultrarrápido de mensajes no leídos (Navbar y notificaciones)
CREATE INDEX IF NOT EXISTS idx_messages_unread_chat 
  ON public.messages(chat_id, is_read) WHERE is_read = false;

-- 5. Índices de moderación y reportes
CREATE INDEX IF NOT EXISTS idx_reports_listing_status 
  ON public.reports(listing_id, status);

CREATE INDEX IF NOT EXISTS idx_reports_reporter 
  ON public.reports(reporter_id);

-- Confirmación de ejecución exitosa
SELECT 'Indices de rendimiento creados exitosamente para U-Market UTA' AS resultado;
