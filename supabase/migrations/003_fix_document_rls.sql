-- Fix document RLS: users should see ALL documents for their assigned workflows,
-- not just the ones they personally uploaded.

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users manage own workflow documents" ON public.documents;

-- New policy: users can view/insert/update/delete all documents
-- for workflows they are assigned to (no uploaded_by check)
CREATE POLICY "Users manage assigned workflow documents" ON public.documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_workflows
      WHERE user_workflows.workflow_id = documents.workflow_id
        AND user_workflows.user_id = auth.uid()
    )
  );
