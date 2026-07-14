
-- GROUPS
CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;

-- GROUP MEMBERS
CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  email text,
  display_name text,
  avatar_url text,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;

-- GROUP INVITATIONS
CREATE TABLE public.group_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  invited_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_invitations TO authenticated;
GRANT ALL ON public.group_invitations TO service_role;

-- GROUP SECTIONS
CREATE TABLE public.group_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  label text NOT NULL,
  color text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_sections TO authenticated;
GRANT ALL ON public.group_sections TO service_role;

-- GROUP TASKS
CREATE TABLE public.group_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assigned_to uuid,
  created_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'todo',
  pts integer NOT NULL DEFAULT 5,
  priority text NOT NULL DEFAULT 'medium',
  due_date date,
  position integer NOT NULL DEFAULT 0,
  section_id uuid,
  deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_tasks TO authenticated;
GRANT ALL ON public.group_tasks TO service_role;

-- GROUP WEEKLY POINTS
CREATE TABLE public.group_weekly_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  week_start date NOT NULL,
  points integer NOT NULL DEFAULT 0,
  tasks_done integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id, week_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_weekly_points TO authenticated;
GRANT ALL ON public.group_weekly_points TO service_role;

-- Membership helper (created AFTER table exists)
CREATE OR REPLACE FUNCTION public.is_group_member(_group uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = _group AND user_id = _user
  );
$$;

-- Auto-add owner as member on group creation
CREATE OR REPLACE FUNCTION public.add_group_owner_as_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.group_members(group_id, user_id, role, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.owner_id,
    'owner',
    (SELECT email FROM auth.users WHERE id = NEW.owner_id),
    (SELECT COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email) FROM auth.users WHERE id = NEW.owner_id),
    (SELECT raw_user_meta_data->>'avatar_url' FROM auth.users WHERE id = NEW.owner_id)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER groups_add_owner_member AFTER INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.add_group_owner_as_member();

CREATE TRIGGER groups_updated_at BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER inv_updated_at BEFORE UPDATE ON public.group_invitations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER gt_updated_at BEFORE UPDATE ON public.group_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER gwp_updated_at BEFORE UPDATE ON public.group_weekly_points
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "groups_select_member" ON public.groups FOR SELECT TO authenticated
  USING (public.is_group_member(id, auth.uid()) OR owner_id = auth.uid());
CREATE POLICY "groups_insert_own" ON public.groups FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "groups_update_owner" ON public.groups FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());
CREATE POLICY "groups_delete_owner" ON public.groups FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gm_select_same_group" ON public.group_members FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()) OR user_id = auth.uid());
CREATE POLICY "gm_insert_self" ON public.group_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "gm_update_self" ON public.group_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "gm_delete_self_or_owner" ON public.group_members FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.owner_id = auth.uid())
  );

ALTER TABLE public.group_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_select_involved" ON public.group_invitations FOR SELECT TO authenticated
  USING (
    invited_by = auth.uid()
    OR lower(invited_email) = lower(auth.jwt()->>'email')
    OR public.is_group_member(group_id, auth.uid())
  );
CREATE POLICY "inv_insert_member" ON public.group_invitations FOR INSERT TO authenticated
  WITH CHECK (public.is_group_member(group_id, auth.uid()) AND invited_by = auth.uid());
CREATE POLICY "inv_update_invitee_or_inviter" ON public.group_invitations FOR UPDATE TO authenticated
  USING (
    lower(invited_email) = lower(auth.jwt()->>'email')
    OR invited_by = auth.uid()
  );
CREATE POLICY "inv_delete_inviter" ON public.group_invitations FOR DELETE TO authenticated
  USING (invited_by = auth.uid());

ALTER TABLE public.group_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gs_all_members" ON public.group_sections FOR ALL TO authenticated
  USING (public.is_group_member(group_id, auth.uid()))
  WITH CHECK (public.is_group_member(group_id, auth.uid()));

ALTER TABLE public.group_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gt_all_members" ON public.group_tasks FOR ALL TO authenticated
  USING (public.is_group_member(group_id, auth.uid()))
  WITH CHECK (public.is_group_member(group_id, auth.uid()));

ALTER TABLE public.group_weekly_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gwp_select_members" ON public.group_weekly_points FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "gwp_insert_self" ON public.group_weekly_points FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_group_member(group_id, auth.uid()));
CREATE POLICY "gwp_update_self" ON public.group_weekly_points FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_invitations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_sections;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_weekly_points;
