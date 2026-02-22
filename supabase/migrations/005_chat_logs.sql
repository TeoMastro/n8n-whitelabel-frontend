-- ============================================================
-- chat_logs
-- ============================================================
CREATE TABLE public.chat_logs (
  id            UUID                     PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id   UUID                     NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  session_id    TEXT                     NOT NULL,
  human_message TEXT                     NOT NULL,
  ai_response   TEXT                     NOT NULL,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_chat_logs_workflow_id  ON public.chat_logs(workflow_id);
CREATE INDEX idx_chat_logs_session_id   ON public.chat_logs(session_id);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE public.chat_logs ENABLE ROW LEVEL SECURITY;

-- Admins can manage all chat logs
CREATE POLICY "Admins manage chat_logs" ON public.chat_logs
  FOR ALL USING (public.is_admin());

-- Note: No policies added for regular or anonymous users to insert or delete. 
-- Assuming insertions will be done from a backend API route using a Service Role key 
-- (which naturally bypasses RLS).
