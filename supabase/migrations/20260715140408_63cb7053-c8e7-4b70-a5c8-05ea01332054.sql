
-- 1. Fix broken groups: restore execute on the membership helper.
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;

-- 2. Notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL, -- 'group_invite' | 'mentor_request' | 'mentor_accepted' | 'mentor_revoked' | 'group_accepted'
  title text NOT NULL,
  body text,
  ref_group_id uuid,
  ref_invitation_id uuid,
  ref_mentorship_id uuid,
  actor_id uuid,
  actor_name text,
  read boolean NOT NULL DEFAULT false,
  handled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_select_own" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "notif_insert_any_auth" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "notif_delete_own" ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 3. Mentorships
CREATE TABLE public.mentorships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL,
  mentee_id uuid,
  mentee_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | accepted | declined | revoked
  mentor_name text,
  mentor_avatar text,
  mentee_name text,
  mentee_avatar text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentorships TO authenticated;
GRANT ALL ON public.mentorships TO service_role;
ALTER TABLE public.mentorships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ment_select_parties" ON public.mentorships FOR SELECT TO authenticated
  USING (
    mentor_id = auth.uid()
    OR mentee_id = auth.uid()
    OR lower(mentee_email) = lower(auth.jwt()->>'email')
  );
CREATE POLICY "ment_insert_mentor" ON public.mentorships FOR INSERT TO authenticated
  WITH CHECK (mentor_id = auth.uid());
CREATE POLICY "ment_update_parties" ON public.mentorships FOR UPDATE TO authenticated
  USING (
    mentor_id = auth.uid()
    OR mentee_id = auth.uid()
    OR lower(mentee_email) = lower(auth.jwt()->>'email')
  );
CREATE POLICY "ment_delete_parties" ON public.mentorships FOR DELETE TO authenticated
  USING (mentor_id = auth.uid() OR mentee_id = auth.uid());

CREATE TRIGGER ment_updated_at BEFORE UPDATE ON public.mentorships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Allow a mentee to read an accepted mentor's user_app_state (read-only oversight).
CREATE POLICY "uas_select_mentor" ON public.user_app_state FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.mentorships m
      WHERE m.mentee_id = user_app_state.user_id
        AND m.mentor_id = auth.uid()
        AND m.status = 'accepted'
    )
  );

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mentorships;
