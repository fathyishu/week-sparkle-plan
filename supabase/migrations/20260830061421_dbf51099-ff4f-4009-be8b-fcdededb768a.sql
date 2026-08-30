CREATE OR REPLACE FUNCTION public.friends_points(_start date DEFAULT NULL::date, _end date DEFAULT NULL::date)
RETURNS TABLE(user_id uuid, points integer, tasks_done integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH circle AS (
    SELECT auth.uid() AS uid
    UNION
    SELECT CASE WHEN f.user_id_a = auth.uid() THEN f.user_id_b ELSE f.user_id_a END
    FROM public.friendships f
    WHERE f.status = 'accepted'
      AND (f.user_id_a = auth.uid() OR f.user_id_b = auth.uid())
  ),
  current_week AS (
    SELECT s.user_id,
           COALESCE(SUM((t->>'points')::int), 0)::int AS points,
           COUNT(*)::int AS tasks_done
    FROM public.user_app_state s
    JOIN circle c ON c.uid = s.user_id
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.data->'days', '[]'::jsonb)) d
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(d->'tasks', '[]'::jsonb)) t
    WHERE t->>'status' = 'done'
      AND (_start IS NULL OR (d->>'isoDate')::date >= _start)
      AND (_end   IS NULL OR (d->>'isoDate')::date <= _end)
    GROUP BY s.user_id
  ),
  past_weeks AS (
    SELECT h.user_id,
           COALESCE(SUM(h.pts_done), 0)::int AS points,
           COALESCE(SUM(h.done), 0)::int AS tasks_done
    FROM public.week_history h
    JOIN circle c ON c.uid = h.user_id
    WHERE (_start IS NULL OR h.week_start + 6 >= _start)
      AND (_end   IS NULL OR h.week_start     <= _end)
    GROUP BY h.user_id
  )
  SELECT c.uid AS user_id,
         (COALESCE(cw.points, 0) + COALESCE(pw.points, 0))::int AS points,
         (COALESCE(cw.tasks_done, 0) + COALESCE(pw.tasks_done, 0))::int AS tasks_done
  FROM circle c
  LEFT JOIN current_week cw ON cw.user_id = c.uid
  LEFT JOIN past_weeks pw ON pw.user_id = c.uid;
$function$