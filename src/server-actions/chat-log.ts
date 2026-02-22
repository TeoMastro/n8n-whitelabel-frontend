'use server';

import { getSession } from '@/lib/auth-session';
import { Role } from '@/lib/constants';
import logger from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';
import type {
  ChatSession,
  ChatLogEntry,
  GetChatSessionsParams,
  GetChatSessionsResult,
} from '@/types/chat-log';

async function checkAuth() {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}

/**
 * For non-admin users, fetch their assigned workflow IDs.
 */
async function getUserWorkflowIds(userId: string): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('user_workflows')
    .select('workflow_id')
    .eq('user_id', userId);

  if (error) throw error;
  return (data || []).map((r) => r.workflow_id);
}

// ============================================================
// Fetch grouped chat sessions (admin sees all, users see own)
// ============================================================

export async function getChatSessionsWithPagination(
  params: GetChatSessionsParams
): Promise<GetChatSessionsResult> {
  try {
    const session = await checkAuth();
    const isAdmin = session.user.role === Role.ADMIN;

    const page = parseInt(params.page || '1');
    const limit = parseInt(params.limit || '10');
    const search = params.search || '';
    const workflowFilter = params.workflowFilter || '';
    const sortField = params.sortField || 'last_message_at';
    const sortDirection = params.sortDirection || 'desc';
    const offset = (page - 1) * limit;

    // For users, restrict to their assigned workflows
    let allowedWorkflowIds: string[] | null = null;
    if (!isAdmin) {
      allowedWorkflowIds = await getUserWorkflowIds(session.user.id);
      if (allowedWorkflowIds.length === 0) {
        return { sessions: [], totalCount: 0, totalPages: 0, currentPage: page, limit };
      }
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase.rpc('get_chat_sessions', {
      p_search: search,
      p_workflow_id: workflowFilter || null,
      p_workflow_ids: allowedWorkflowIds,
      p_sort_field: sortField,
      p_sort_dir: sortDirection,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) throw error;

    const rows = (data || []) as Array<{
      session_id: string;
      workflow_id: string;
      workflow_name: string;
      message_count: number;
      first_message_at: string;
      last_message_at: string;
      total_count: number;
    }>;

    const totalCount = rows.length > 0 ? rows[0].total_count : 0;
    const totalPages = Math.ceil(totalCount / limit);

    const sessions: ChatSession[] = rows.map((r) => ({
      sessionId: r.session_id,
      workflowId: r.workflow_id,
      workflowName: r.workflow_name,
      messageCount: r.message_count,
      firstMessageAt: new Date(r.first_message_at),
      lastMessageAt: new Date(r.last_message_at),
    }));

    return { sessions, totalCount, totalPages, currentPage: page, limit };
  } catch (error) {
    logger.error('Error fetching chat sessions', { error: (error as Error).message });
    throw error;
  }
}

// ============================================================
// Fetch messages for a single session
// ============================================================

export async function getChatSessionMessages(
  sessionId: string
): Promise<{ messages: ChatLogEntry[]; workflowName: string }> {
  try {
    const session = await checkAuth();
    const isAdmin = session.user.role === Role.ADMIN;

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('chat_logs')
      .select('id, session_id, workflow_id, human_message, ai_response, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const rows = data || [];

    // For users, verify they have access to this workflow
    if (!isAdmin && rows.length > 0) {
      const allowedWorkflowIds = await getUserWorkflowIds(session.user.id);
      if (!allowedWorkflowIds.includes(rows[0].workflow_id)) {
        throw new Error('Unauthorized');
      }
    }

    // Get workflow name from the first row
    let workflowName = '';
    if (rows.length > 0) {
      const { data: wf } = await supabase
        .from('workflows')
        .select('name')
        .eq('id', rows[0].workflow_id)
        .single();
      workflowName = wf?.name || '';
    }

    const messages: ChatLogEntry[] = rows.map((r) => ({
      id: r.id,
      sessionId: r.session_id,
      humanMessage: r.human_message,
      aiResponse: r.ai_response,
      createdAt: new Date(r.created_at),
    }));

    return { messages, workflowName };
  } catch (error) {
    logger.error('Error fetching chat session messages', { error: (error as Error).message });
    throw error;
  }
}

// ============================================================
// Fetch workflows for filter dropdown
// ============================================================

export async function getWorkflowsForFilter(): Promise<{ id: string; name: string }[]> {
  try {
    const session = await checkAuth();
    const isAdmin = session.user.role === Role.ADMIN;

    const supabase = createAdminClient();

    if (isAdmin) {
      const { data, error } = await supabase
        .from('workflows')
        .select('id, name')
        .eq('type', 'chat')
        .order('name');
      if (error) throw error;
      return (data || []).map((w) => ({ id: w.id, name: w.name }));
    } else {
      // Users only see their assigned workflows
      const workflowIds = await getUserWorkflowIds(session.user.id);
      if (workflowIds.length === 0) return [];

      const { data, error } = await supabase
        .from('workflows')
        .select('id, name')
        .eq('type', 'chat')
        .in('id', workflowIds)
        .order('name');
      if (error) throw error;
      return (data || []).map((w) => ({ id: w.id, name: w.name }));
    }
  } catch (error) {
    logger.error('Error fetching workflows for filter', { error: (error as Error).message });
    throw error;
  }
}
