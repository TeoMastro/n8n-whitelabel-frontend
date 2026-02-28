-- ============================================================
-- trigger_logs
-- ============================================================

CREATE TABLE public.trigger_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id     UUID        NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status          TEXT        NOT NULL CHECK (status IN ('success', 'error')),
  request_params  JSONB       DEFAULT '{}'::jsonb,
  response_data   JSONB       DEFAULT '{}'::jsonb,
  error_message   TEXT,
  duration_ms     INTEGER     NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  execution_id    TEXT,
  CONSTRAINT trigger_logs_execution_id_unique UNIQUE (execution_id)
);

-- Indexes for efficient querying by workflow, user, and time
CREATE INDEX idx_trigger_logs_workflow_id ON public.trigger_logs(workflow_id);
CREATE INDEX idx_trigger_logs_user_id     ON public.trigger_logs(user_id);
CREATE INDEX idx_trigger_logs_created_at  ON public.trigger_logs(created_at);
CREATE INDEX idx_trigger_logs_status      ON public.trigger_logs(status);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE public.trigger_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all executions
CREATE POLICY "Admins view all trigger_logs" ON public.trigger_logs
  FOR SELECT USING (public.is_admin());

-- Users can view executions for workflows they are assigned to
CREATE POLICY "Users view assigned trigger_logs" ON public.trigger_logs
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.user_workflows uw
      WHERE uw.user_id = auth.uid() AND uw.workflow_id = trigger_logs.workflow_id
    )
  );

-- Note: No policies added for INSERT/UPDATE/DELETE.
-- Insertions will be done from a backend API route using a Service Role key, 
-- which naturally bypasses RLS.
