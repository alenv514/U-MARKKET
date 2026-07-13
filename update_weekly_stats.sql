-- =============================================
-- ACTUALIZAR ESTADÍSTICAS SEMANALES CON SUBQUERIES
-- =============================================
-- Ejecuta este script en el SQL Editor de tu Supabase.
-- Corregirá el conteo de nuevas publicaciones y nuevos usuarios en el gráfico.

CREATE OR REPLACE FUNCTION public.get_weekly_stats()
RETURNS TABLE (
  day date,
  new_listings bigint,
  new_users bigint
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH dates AS (
    SELECT generate_series(
      current_date - interval '6 days', 
      current_date, 
      '1 day'::interval
    )::date as d
  )
  SELECT 
    dates.d as day,
    (
      SELECT COALESCE(COUNT(*), 0)::bigint 
      FROM public.listings l 
      WHERE date_trunc('day', l.created_at)::date = dates.d
    ) as new_listings,
    (
      SELECT COALESCE(COUNT(*), 0)::bigint 
      FROM public.profiles p 
      WHERE date_trunc('day', p.created_at)::date = dates.d
    ) as new_users
  FROM dates
  ORDER BY dates.d ASC;
END;
$$;
