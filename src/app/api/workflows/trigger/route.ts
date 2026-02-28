import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import logger from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { workflowId, params = {} } = body as {
      workflowId: string;
      params?: Record<string, unknown>;
    };

    if (!workflowId) {
      return NextResponse.json({ error: 'Missing workflowId' }, { status: 400 });
    }

    // Verify user is assigned to this workflow (RLS also enforces this)
    const { data: workflow, error: wfError } = await supabase
      .from('workflows')
      .select('id, webhook_url, config, type')
      .eq('id', workflowId)
      .eq('is_active', true)
      .single();

    if (wfError || !workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // Build payload: merge config defaults + user params
    const payload = {
      workflowId,
      userId: user.id,
      ...params,
    };

    const startTime = performance.now();
    let n8nResponse;
    let responseText = '';
    let responseData: unknown;
    let fetchError: Error | null = null;
    
    try {
      // Forward to n8n webhook
      n8nResponse = await fetch(workflow.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      responseText = await n8nResponse.text();
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { text: responseText };
      }
    } catch (err) {
      fetchError = err as Error;
    }
    
    const durationMs = Math.round(performance.now() - startTime);
    const status = fetchError || (n8nResponse && !n8nResponse.ok) ? 'error' : 'success';
    const errorMessage = fetchError 
      ? fetchError.message 
      : (n8nResponse && !n8nResponse.ok ? `HTTP ${n8nResponse.status}: ${responseText.substring(0, 200)}` : null);

    // Extract execution_id if returned by n8n
    let executionId = null;
    if (responseData && typeof responseData === 'object' && 'execution_id' in responseData) {
      executionId = (responseData as any).execution_id;
    }

    // Log the execution — use admin client to bypass RLS (no INSERT policy on trigger_logs)
    const { error: insertError } = await createAdminClient()
      .from('trigger_logs')
      .insert({
        execution_id: executionId,
        workflow_id: workflowId,
        user_id: user.id,
        status,
        request_params: params,
        response_data: responseData || null,
        error_message: errorMessage,
        duration_ms: durationMs
      });

    if (insertError) {
      logger.error('Failed to log trigger execution', { error: insertError.message });
      // We don't fail the workflow run just because logging failed, but we log the error
    }

    if (fetchError) {
      logger.error('Workflow trigger failed', { error: fetchError.message });
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    logger.info('Workflow triggered', { workflowId, userId: user.id, status, durationMs });

    return NextResponse.json({ success: status === 'success', data: responseData });
  } catch (error) {
    logger.error('Workflow trigger failed', { error: (error as Error).message });
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
