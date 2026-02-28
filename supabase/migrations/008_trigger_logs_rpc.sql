-- =====================================================================
-- POSTGRES RPC: get_trigger_logs
-- Purpose: Support server-side pagination, searching, sorting, and filtering
--          for the trigger_logs table in the Next.js admin/user UI.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_trigger_logs(
  p_search TEXT DEFAULT '',
  p_workflow_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT '',
  p_sort_field TEXT DEFAULT 'created_at',
  p_sort_dir TEXT DEFAULT 'desc',
  p_limit INT DEFAULT 10,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  workflow_id UUID,
  workflow_name TEXT,
  user_id UUID,
  user_email TEXT,
  status TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ,
  execution_id TEXT,
  total_count BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_count BIGINT;
BEGIN
  -- 1) Count total matching rows
  SELECT COUNT(*)
    INTO v_count
  FROM public.trigger_logs t
  JOIN public.workflows w ON t.workflow_id = w.id
  JOIN public.profiles p ON t.user_id = p.id
  WHERE 
    (p_workflow_id IS NULL OR t.workflow_id = p_workflow_id)
    AND (
      p_user_id IS NULL 
      OR t.user_id = p_user_id
      OR EXISTS (
        SELECT 1 FROM public.user_workflows uw
        WHERE uw.user_id = p_user_id AND uw.workflow_id = t.workflow_id
      )
    )
    AND (p_status = '' OR t.status = p_status)
    AND (
      p_search = '' 
      OR w.name ILIKE '%' || p_search || '%'
      OR p.email ILIKE '%' || p_search || '%'
      OR t.error_message ILIKE '%' || p_search || '%'
      OR t.execution_id ILIKE '%' || p_search || '%'
    );

  -- 2) Return paginated payload
  RETURN QUERY
  SELECT 
    t.id,
    t.workflow_id,
    w.name AS workflow_name,
    t.user_id,
    p.email AS user_email,
    t.status,
    t.duration_ms,
    t.created_at,
    t.execution_id,
    v_count AS total_count
  FROM public.trigger_logs t
  JOIN public.workflows w ON t.workflow_id = w.id
  JOIN public.profiles p ON t.user_id = p.id
  WHERE 
    (p_workflow_id IS NULL OR t.workflow_id = p_workflow_id)
    AND (
      p_user_id IS NULL 
      OR t.user_id = p_user_id
      OR EXISTS (
        SELECT 1 FROM public.user_workflows uw
        WHERE uw.user_id = p_user_id AND uw.workflow_id = t.workflow_id
      )
    )
    AND (p_status = '' OR t.status = p_status)
    AND (
      p_search = '' 
      OR w.name ILIKE '%' || p_search || '%'
      OR p.email ILIKE '%' || p_search || '%'
      OR t.error_message ILIKE '%' || p_search || '%'
      OR t.execution_id ILIKE '%' || p_search || '%'
    )
  ORDER BY 
    CASE WHEN p_sort_field = 'workflow_name' AND p_sort_dir = 'asc' THEN w.name END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'workflow_name' AND p_sort_dir = 'desc' THEN w.name END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'user_email' AND p_sort_dir = 'asc' THEN p.email END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'user_email' AND p_sort_dir = 'desc' THEN p.email END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'status' AND p_sort_dir = 'asc' THEN t.status END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'status' AND p_sort_dir = 'desc' THEN t.status END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'duration_ms' AND p_sort_dir = 'asc' THEN t.duration_ms END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'duration_ms' AND p_sort_dir = 'desc' THEN t.duration_ms END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'created_at' AND p_sort_dir = 'asc' THEN t.created_at END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'created_at' AND p_sort_dir = 'desc' THEN t.created_at END DESC NULLS LAST,
    -- Fallback
    t.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
