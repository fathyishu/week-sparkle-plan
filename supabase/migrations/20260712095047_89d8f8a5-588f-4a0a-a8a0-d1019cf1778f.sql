
-- shared updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- task_states
CREATE TABLE public.task_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  day_number INTEGER NOT NULL,
  task_key TEXT NOT NULL,
  state INTEGER NOT NULL DEFAULT 0,
  deleted BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start, day_number, task_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_states TO authenticated;
GRANT ALL ON public.task_states TO service_role;
ALTER TABLE public.task_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own task_states select" ON public.task_states FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own task_states insert" ON public.task_states FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own task_states update" ON public.task_states FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own task_states delete" ON public.task_states FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_task_states_updated_at BEFORE UPDATE ON public.task_states FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- carryovers
CREATE TABLE public.carryovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  to_day INTEGER NOT NULL,
  text TEXT NOT NULL,
  from_day INTEGER NOT NULL,
  pts INTEGER NOT NULL DEFAULT 0,
  orig_key TEXT NOT NULL,
  state INTEGER NOT NULL DEFAULT 0,
  deleted BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.carryovers TO authenticated;
GRANT ALL ON public.carryovers TO service_role;
ALTER TABLE public.carryovers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own carryovers select" ON public.carryovers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own carryovers insert" ON public.carryovers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own carryovers update" ON public.carryovers FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own carryovers delete" ON public.carryovers FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_carryovers_updated_at BEFORE UPDATE ON public.carryovers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- custom_tasks
CREATE TABLE public.custom_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  day_number INTEGER NOT NULL,
  section_id TEXT NOT NULL,
  text TEXT NOT NULL,
  pts INTEGER NOT NULL DEFAULT 1,
  state INTEGER NOT NULL DEFAULT 0,
  deleted BOOLEAN NOT NULL DEFAULT false,
  from_day INTEGER,
  daily BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_tasks TO authenticated;
GRANT ALL ON public.custom_tasks TO service_role;
ALTER TABLE public.custom_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own custom_tasks select" ON public.custom_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own custom_tasks insert" ON public.custom_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own custom_tasks update" ON public.custom_tasks FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own custom_tasks delete" ON public.custom_tasks FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_custom_tasks_updated_at BEFORE UPDATE ON public.custom_tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- notepad_items
CREATE TABLE public.notepad_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  day_number INTEGER NOT NULL,
  text TEXT NOT NULL,
  pts INTEGER NOT NULL DEFAULT 3,
  state INTEGER NOT NULL DEFAULT 0,
  deleted BOOLEAN NOT NULL DEFAULT false,
  from_day INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notepad_items TO authenticated;
GRANT ALL ON public.notepad_items TO service_role;
ALTER TABLE public.notepad_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notepad_items select" ON public.notepad_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own notepad_items insert" ON public.notepad_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own notepad_items update" ON public.notepad_items FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own notepad_items delete" ON public.notepad_items FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_notepad_items_updated_at BEFORE UPDATE ON public.notepad_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- custom_sections
CREATE TABLE public.custom_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL,
  label TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, section_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_sections TO authenticated;
GRANT ALL ON public.custom_sections TO service_role;
ALTER TABLE public.custom_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own custom_sections select" ON public.custom_sections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own custom_sections insert" ON public.custom_sections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own custom_sections update" ON public.custom_sections FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own custom_sections delete" ON public.custom_sections FOR DELETE USING (auth.uid() = user_id);

-- week_history
CREATE TABLE public.week_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  week_start DATE NOT NULL,
  date_range TEXT NOT NULL,
  task_pct INTEGER NOT NULL DEFAULT 0,
  pts_pct INTEGER NOT NULL DEFAULT 0,
  done INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  pts_done INTEGER NOT NULL DEFAULT 0,
  pts_total INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.week_history TO authenticated;
GRANT ALL ON public.week_history TO service_role;
ALTER TABLE public.week_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own week_history select" ON public.week_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own week_history insert" ON public.week_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own week_history update" ON public.week_history FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own week_history delete" ON public.week_history FOR DELETE USING (auth.uid() = user_id);

-- week_start_preference
CREATE TABLE public.week_start_preference (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  current_week_start DATE NOT NULL,
  week_number INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.week_start_preference TO authenticated;
GRANT ALL ON public.week_start_preference TO service_role;
ALTER TABLE public.week_start_preference ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own week_start_preference select" ON public.week_start_preference FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own week_start_preference insert" ON public.week_start_preference FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own week_start_preference update" ON public.week_start_preference FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own week_start_preference delete" ON public.week_start_preference FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_week_start_preference_updated_at BEFORE UPDATE ON public.week_start_preference FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- realtime
ALTER TABLE public.task_states REPLICA IDENTITY FULL;
ALTER TABLE public.carryovers REPLICA IDENTITY FULL;
ALTER TABLE public.custom_tasks REPLICA IDENTITY FULL;
ALTER TABLE public.notepad_items REPLICA IDENTITY FULL;
ALTER TABLE public.custom_sections REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_states;
ALTER PUBLICATION supabase_realtime ADD TABLE public.carryovers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.custom_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notepad_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.custom_sections;
