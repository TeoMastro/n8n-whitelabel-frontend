-- Index on workflow_usage.execution_id for efficient trigger log cost lookups
CREATE INDEX idx_workflow_usage_execution_id ON public.workflow_usage(execution_id);
