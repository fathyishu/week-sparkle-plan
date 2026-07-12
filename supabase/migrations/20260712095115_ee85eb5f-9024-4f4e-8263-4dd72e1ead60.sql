
CREATE TABLE public.user_app_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_app_state TO authenticated;
GRANT ALL ON public.user_app_state TO service_role;
ALTER TABLE public.user_app_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own user_app_state select" ON public.user_app_state FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own user_app_state insert" ON public.user_app_state FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own user_app_state update" ON public.user_app_state FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own user_app_state delete" ON public.user_app_state FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_user_app_state_updated_at BEFORE UPDATE ON public.user_app_state FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.user_app_state REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_app_state;
