-- ============================================================
-- RPC: get_chat_sessions
-- Returns chat_logs grouped by session_id with pagination
-- Supports optional workflow_ids filter (for user role)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_chat_sessions(
  p_search        TEXT    DEFAULT '',
  p_workflow_id   UUID    DEFAULT NULL,
  p_workflow_ids  UUID[]  DEFAULT NULL,
  p_sort_field    TEXT    DEFAULT 'last_message_at',
  p_sort_dir      TEXT    DEFAULT 'desc',
  p_limit         INTEGER DEFAULT 10,
  p_offset        INTEGER DEFAULT 0
)
RETURNS TABLE (
  session_id       TEXT,
  workflow_id      UUID,
  workflow_name    TEXT,
  message_count    BIGINT,
  first_message_at TIMESTAMPTZ,
  last_message_at  TIMESTAMPTZ,
  total_count      BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total BIGINT;
BEGIN
  -- Count total matching sessions
  SELECT COUNT(*) INTO v_total
  FROM (
    SELECT cl.session_id
    FROM public.chat_logs cl
    WHERE (p_search = '' OR cl.session_id ILIKE '%' || p_search || '%')
      AND (p_workflow_id IS NULL OR cl.workflow_id = p_workflow_id)
      AND (p_workflow_ids IS NULL OR cl.workflow_id = ANY(p_workflow_ids))
    GROUP BY cl.session_id
  ) sub;

  RETURN QUERY
  SELECT
    cl.session_id,
    cl.workflow_id,
    w.name AS workflow_name,
    COUNT(*)::BIGINT AS message_count,
    MIN(cl.created_at) AS first_message_at,
    MAX(cl.created_at) AS last_message_at,
    v_total AS total_count
  FROM public.chat_logs cl
  JOIN public.workflows w ON w.id = cl.workflow_id
  WHERE (p_search = '' OR cl.session_id ILIKE '%' || p_search || '%')
    AND (p_workflow_id IS NULL OR cl.workflow_id = p_workflow_id)
    AND (p_workflow_ids IS NULL OR cl.workflow_id = ANY(p_workflow_ids))
  GROUP BY cl.session_id, cl.workflow_id, w.name
  ORDER BY
    CASE WHEN p_sort_field = 'last_message_at'  AND p_sort_dir = 'desc' THEN MAX(cl.created_at) END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'last_message_at'  AND p_sort_dir = 'asc'  THEN MAX(cl.created_at) END ASC  NULLS LAST,
    CASE WHEN p_sort_field = 'first_message_at' AND p_sort_dir = 'desc' THEN MIN(cl.created_at) END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'first_message_at' AND p_sort_dir = 'asc'  THEN MIN(cl.created_at) END ASC  NULLS LAST,
    CASE WHEN p_sort_field = 'message_count'    AND p_sort_dir = 'desc' THEN COUNT(*) END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'message_count'    AND p_sort_dir = 'asc'  THEN COUNT(*) END ASC  NULLS LAST,
    CASE WHEN p_sort_field = 'workflow_name'    AND p_sort_dir = 'desc' THEN w.name END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'workflow_name'    AND p_sort_dir = 'asc'  THEN w.name END ASC  NULLS LAST,
    MAX(cl.created_at) DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
