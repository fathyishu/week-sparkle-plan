
CREATE OR REPLACE FUNCTION public.is_mentor_of(_mentee uuid, _mentor uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mentorships
    WHERE mentee_id = _mentee
      AND mentor_id = _mentor
      AND status = 'accepted'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_mentor_of(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "mentor read mentee state" ON public.user_app_state;
CREATE POLICY "mentor read mentee state" ON public.user_app_state
  FOR SELECT TO authenticated
  USING (public.is_mentor_of(user_id, auth.uid()));

DROP POLICY IF EXISTS "mentor update mentee state" ON public.user_app_state;
CREATE POLICY "mentor update mentee state" ON public.user_app_state
  FOR UPDATE TO authenticated
  USING (public.is_mentor_of(user_id, auth.uid()))
  WITH CHECK (public.is_mentor_of(user_id, auth.uid()));
