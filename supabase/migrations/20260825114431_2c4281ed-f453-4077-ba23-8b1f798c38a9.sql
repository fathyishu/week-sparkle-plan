CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_a uuid NOT NULL,
  user_id_b uuid,
  invited_email text NOT NULL,
  name_a text,
  name_b text,
  avatar_a text,
  avatar_b text,
  status text NOT NULL DEFAULT 'pending',
  requested_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "friendship parties can read"
ON public.friendships FOR SELECT TO authenticated
USING (
  user_id_a = auth.uid()
  OR user_id_b = auth.uid()
  OR lower(invited_email) = lower(coalesce(auth.jwt()->>'email',''))
);

CREATE POLICY "users create own friend requests"
ON public.friendships FOR INSERT TO authenticated
WITH CHECK (requested_by = auth.uid() AND user_id_a = auth.uid());

CREATE POLICY "friendship parties can update"
ON public.friendships FOR UPDATE TO authenticated
USING (
  user_id_a = auth.uid()
  OR user_id_b = auth.uid()
  OR lower(invited_email) = lower(coalesce(auth.jwt()->>'email',''))
);

CREATE POLICY "friendship parties can delete"
ON public.friendships FOR DELETE TO authenticated
USING (user_id_a = auth.uid() OR user_id_b = auth.uid());

CREATE TRIGGER trg_friendships_updated_at
BEFORE UPDATE ON public.friendships
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.friends_points(_start date DEFAULT NULL, _end date DEFAULT NULL)
RETURNS TABLE (user_id uuid, points integer, tasks_done integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH circle AS (
    SELECT auth.uid() AS uid
    UNION
    SELECT CASE WHEN f.user_id_a = auth.uid() THEN f.user_id_b ELSE f.user_id_a END
    FROM public.friendships f
    WHERE f.status = 'accepted'
      AND (f.user_id_a = auth.uid() OR f.user_id_b = auth.uid())
  )
  SELECT s.user_id,
         COALESCE(SUM((t->>'points')::int), 0)::int AS points,
         COUNT(*)::int AS tasks_done
  FROM public.user_app_state s
  JOIN circle c ON c.uid = s.user_id
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.data->'days', '[]'::jsonb)) d
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(d->'tasks', '[]'::jsonb)) t
  WHERE t->>'status' = 'done'
    AND (_start IS NULL OR (d->>'isoDate')::date >= _start)
    AND (_end IS NULL OR (d->>'isoDate')::date <= _end)
  GROUP BY s.user_id
$$;

GRANT EXECUTE ON FUNCTION public.friends_points(date, date) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'group_weekly_points'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_weekly_points;
  END IF;
END $$;
