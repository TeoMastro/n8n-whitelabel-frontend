import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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

    // Forward to n8n webhook
    const n8nResponse = await fetch(workflow.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const responseText = await n8nResponse.text();
    let responseData: unknown;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { text: responseText };
    }

    logger.info('Workflow triggered', { workflowId, userId: user.id });

    return NextResponse.json({ success: true, data: responseData });
  } catch (error) {
    logger.error('Workflow trigger failed', { error: (error as Error).message });
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
