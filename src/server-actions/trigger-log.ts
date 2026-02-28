'use server';

import { getSession } from '@/lib/auth-session';
import { Role } from '@/lib/constants';
import logger from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculateCost } from '@/lib/pricing';
import type {
  TriggerLogEntry,
  GetTriggerLogsParams,
  GetTriggerLogsResult,
} from '@/types/trigger-log';

async function checkAuth() {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}

// ============================================================
// Fetch trigger logs list (Admin configures all, Users see own)
// ============================================================

export async function getTriggerLogsWithPagination(
  params: GetTriggerLogsParams
): Promise<GetTriggerLogsResult> {
  try {
    const session = await checkAuth();
    const isAdmin = session.user.role === Role.ADMIN;

    const page = parseInt(params.page || '1');
    const limit = parseInt(params.limit || '10');
    const search = params.search || '';
    const workflowFilter = params.workflowFilter || '';
    const statusFilter = params.statusFilter || '';
    const sortField = params.sortField || 'created_at';
    const sortDirection = params.sortDirection || 'desc';
    const offset = (page - 1) * limit;

    // Strict Role-Based Data Access
    // Admins send NULL to fetch all users, regular users send their own ID to enforce safety.
    const strictUserId = isAdmin ? null : session.user.id;

    const supabase = createAdminClient();

    const { data, error } = await supabase.rpc('get_trigger_logs', {
      p_search: search,
      p_workflow_id: workflowFilter || null,
      p_user_id: strictUserId,
      p_status: statusFilter,
      p_sort_field: sortField,
      p_sort_dir: sortDirection,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) throw error;

    const rows = (data || []) as Array<{
      id: string;
      workflow_id: string;
      workflow_name: string;
      user_id: string;
      user_email: string;
      status: 'success' | 'error';
      duration_ms: number;
      created_at: string;
      execution_id: string | null;
      total_count: number;
    }>;

    const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;
    const totalPages = Math.ceil(totalCount / limit);

    const logs: TriggerLogEntry[] = rows.map((r) => ({
      id: r.id,
      workflowId: r.workflow_id,
      workflowName: r.workflow_name,
      userId: r.user_id,
      userEmail: r.user_email,
      status: r.status,
      durationMs: r.duration_ms,
      createdAt: new Date(r.created_at),
      executionId: r.execution_id,
      requestParams: {}, // Truncated to save bandwidth on lists
      responseData: null,
      errorMessage: null,
      totalCost: 0, // Not fetched in list view
    }));

    return { logs, totalCount, totalPages, currentPage: page, limit };
  } catch (error) {
    logger.error('Error fetching trigger logs pagination', { error: (error as Error).message });
    throw error;
  }
}

// ============================================================
// Fetch single trigger log detail view
// ============================================================

export async function getTriggerLogDetail(id: string): Promise<TriggerLogEntry> {
  try {
    const session = await checkAuth();
    const isAdmin = session.user.role === Role.ADMIN;
    
    const supabase = createAdminClient();

    // Base query
    let query = supabase
      .from('trigger_logs')
      .select('id, workflow_id, user_id, status, request_params, response_data, error_message, duration_ms, created_at, execution_id');

    // We bypass initial RLS using admin client to fetch the row, 
    // then authorize the user manually to allow assigned-workflow viewing.
    const { data: row, error } = await query.eq('id', id).single();

    if (error || !row) {
      throw new Error('Trigger log not found');
    }

    if (!isAdmin && row.user_id !== session.user.id) {
      // Check if user is assigned to the workflow
      const { data: assignment, error: assignmentError } = await supabase
        .from('user_workflows')
        .select('workflow_id')
        .eq('user_id', session.user.id)
        .eq('workflow_id', row.workflow_id)
        .single();
        
      if (assignmentError || !assignment) {
        throw new Error('Unauthorized');
      }
    }

    // Fetch related display names and usage cost in parallel
    const [wfRes, userRes, usageRes] = await Promise.all([
      supabase.from('workflows').select('name').eq('id', row.workflow_id).single(),
      supabase.from('profiles').select('email').eq('id', row.user_id).single(),
      row.execution_id
        ? supabase.from('workflow_usage').select('model, prompt_tokens, completion_tokens').eq('execution_id', row.execution_id)
        : Promise.resolve({ data: null, error: null }),
    ]);

    const totalCost = (usageRes.data || []).reduce((acc: number, usage: { model: string; prompt_tokens: number; completion_tokens: number }) => {
      return acc + calculateCost(usage.model, usage.prompt_tokens, usage.completion_tokens);
    }, 0);

    return {
      id: row.id,
      workflowId: row.workflow_id,
      workflowName: wfRes.data?.name || 'Unknown Workflow',
      userId: row.user_id,
      userEmail: userRes.data?.email || 'Unknown User',
      status: row.status as 'success' | 'error',
      requestParams: row.request_params as Record<string, unknown>,
      responseData: row.response_data,
      errorMessage: row.error_message,
      durationMs: row.duration_ms,
      createdAt: new Date(row.created_at),
      executionId: row.execution_id,
      totalCost,
    };

  } catch (error) {
    logger.error('Error fetching trigger log detail', { error: (error as Error).message });
    throw error;
  }
}

// ============================================================
// Fetch workflows for filter dropdown (Only trigger workflows)
// ============================================================

export async function getTriggerWorkflowsForFilter(): Promise<{ id: string; name: string }[]> {
  try {
    const session = await checkAuth();
    const isAdmin = session.user.role === Role.ADMIN;
    const supabase = createAdminClient();

    if (isAdmin) {
      const { data, error } = await supabase
        .from('workflows')
        .select('id, name')
        .eq('type', 'trigger')
        .order('name');
      if (error) throw error;
      return (data || []).map((w) => ({ id: w.id, name: w.name }));
    } else {
      // Users see workflows they are assigned to
      const { data, error } = await supabase
        .from('user_workflows')
        .select('workflow_id, workflows!inner(name, type)')
        .eq('user_id', session.user.id)
        .eq('workflows.type', 'trigger');
      
      if (error) throw error;

      // Deduplicate workflows and map to array
      const wfMap = new Map<string, string>();
      (data || []).forEach((row: any) => {
        if (row.workflows && row.workflows.name) {
          wfMap.set(row.workflow_id, row.workflows.name);
        }
      });
      return Array.from(wfMap.entries()).map(([id, name]) => ({ id, name })).sort((a,b) => a.name.localeCompare(b.name));
    }
  } catch (error) {
    logger.error('Error fetching trigger workflows for filter', { error: (error as Error).message });
    throw error;
  }
}
