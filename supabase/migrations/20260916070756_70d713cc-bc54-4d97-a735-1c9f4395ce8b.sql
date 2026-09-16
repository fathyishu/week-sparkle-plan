CREATE TABLE public.group_sprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_sprints TO authenticated;
GRANT ALL ON public.group_sprints TO service_role;

ALTER TABLE public.group_sprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read sprints" ON public.group_sprints
  FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Members can create sprints" ON public.group_sprints
  FOR INSERT TO authenticated
  WITH CHECK (public.is_group_member(group_id, auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Members can update sprints" ON public.group_sprints
  FOR UPDATE TO authenticated
  USING (public.is_group_member(group_id, auth.uid()))
  WITH CHECK (public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Members can delete sprints" ON public.group_sprints
  FOR DELETE TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));

ALTER TABLE public.group_tasks ADD COLUMN sprint_id uuid REFERENCES public.group_sprints(id) ON DELETE SET NULL;

CREATE INDEX idx_group_tasks_sprint ON public.group_tasks(sprint_id);
CREATE INDEX idx_group_sprints_group ON public.group_sprints(group_id);