'use server';

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-session';
import { revalidatePath } from 'next/cache';
import { Role, WorkflowType } from '@/lib/constants';
import {
  createWorkflowSchema,
  updateWorkflowSchema,
  assignWorkflowSchema,
  formatZodErrors,
} from '@/lib/validation-schemas';
import logger from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type {
  Workflow,
  WorkflowFormState,
  WorkflowAssignment,
  AssignWorkflowFormState,
  GetWorkflowsParams,
  GetWorkflowsResult,
} from '@/types/workflow';

async function checkAdminAuth() {
  const session = await getSession();
  if (!session || session.user.role !== Role.ADMIN) {
    throw new Error('Unauthorized');
  }
  return session;
}

function mapWorkflow(w: Record<string, unknown>): Workflow {
  const config = (w.config as Record<string, unknown>) ?? {};
  return {
    id: w.id as string,
    name: w.name as string,
    description: (w.description as string | null) ?? null,
    type: w.type as WorkflowType,
    webhookUrl: w.webhook_url as string,
    hasKnowledgeBase: w.has_knowledge_base as boolean,
    config: {
      params: (config.params as Workflow['config']['params']) ?? [],
    },
    isActive: w.is_active as boolean,
    createdBy: (w.created_by as string | null) ?? null,
    createdAt: new Date(w.created_at as string),
    updatedAt: new Date(w.updated_at as string),
  };
}

// ============================================================
// Admin: CRUD
// ============================================================

export async function createWorkflowAction(
  prevState: WorkflowFormState,
  formData: FormData
): Promise<WorkflowFormState> {
  try {
    const session = await checkAdminAuth();

    const data = {
      name: formData.get('name')?.toString() ?? '',
      description: formData.get('description')?.toString() ?? '',
      type: (formData.get('type')?.toString() ?? 'chat') as WorkflowType,
      webhook_url: formData.get('webhook_url')?.toString() ?? '',
      has_knowledge_base: formData.get('has_knowledge_base') === 'on',
      is_active: formData.get('is_active') !== 'off',
      params_json: formData.get('params_json')?.toString() ?? '',
    };

    const parsed = createWorkflowSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        errors: formatZodErrors(parsed.error),
        formData: data,
        globalError: null,
      };
    }

    // Parse params JSON
    let parsedParams: unknown[] = [];
    if (parsed.data.params_json) {
      try {
        const raw = JSON.parse(parsed.data.params_json);
        if (!Array.isArray(raw)) throw new Error();
        parsedParams = raw;
      } catch {
        return {
          success: false,
          errors: { params_json: ['workflowParamsInvalidJson'] },
          formData: data,
          globalError: null,
        };
      }
    }

    const supabase = createAdminClient();
    const config = {
      params: parsedParams,
    };

    const { error } = await supabase.from('workflows').insert({
      name: parsed.data.name.trim(),
      description: parsed.data.description?.trim() || null,
      type: parsed.data.type,
      webhook_url: parsed.data.webhook_url.trim(),
      has_knowledge_base: parsed.data.has_knowledge_base,
      is_active: parsed.data.is_active,
      config,
      created_by: session.user.id,
    });

    if (error) throw error;

    logger.info('Workflow created', { adminId: session.user.id });
    revalidatePath('/admin/workflow');
  } catch (error) {
    logger.error('Error creating workflow', { error: (error as Error).message });
    return {
      success: false,
      errors: {},
      formData: {
        name: formData.get('name')?.toString() ?? '',
        description: formData.get('description')?.toString() ?? '',
        type: (formData.get('type')?.toString() ?? 'chat') as WorkflowType,
        webhook_url: formData.get('webhook_url')?.toString() ?? '',
        has_knowledge_base: formData.get('has_knowledge_base') === 'on',
        is_active: formData.get('is_active') !== 'off',
        params_json: formData.get('params_json')?.toString() ?? '',
      },
      globalError: 'unexpectedError',
    };
  }
  redirect('/admin/workflow?message=workflowCreatedSuccess');
}

export async function updateWorkflowAction(
  workflowId: string,
  prevState: WorkflowFormState,
  formData: FormData
): Promise<WorkflowFormState> {
  try {
    const session = await checkAdminAuth();

    const data = {
      name: formData.get('name')?.toString() ?? '',
      description: formData.get('description')?.toString() ?? '',
      type: (formData.get('type')?.toString() ?? 'chat') as WorkflowType,
      webhook_url: formData.get('webhook_url')?.toString() ?? '',
      has_knowledge_base: formData.get('has_knowledge_base') === 'on',
      is_active: formData.get('is_active') !== 'off',
      params_json: formData.get('params_json')?.toString() ?? '',
    };

    const parsed = updateWorkflowSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        errors: formatZodErrors(parsed.error),
        formData: data,
        globalError: null,
      };
    }

    // Parse params JSON
    let parsedParams: unknown[] = [];
    if (parsed.data.params_json) {
      try {
        const raw = JSON.parse(parsed.data.params_json);
        if (!Array.isArray(raw)) throw new Error();
        parsedParams = raw;
      } catch {
        return {
          success: false,
          errors: { params_json: ['workflowParamsInvalidJson'] },
          formData: data,
          globalError: null,
        };
      }
    }

    const supabase = createAdminClient();

    // Fetch existing config to preserve any unmanaged fields
    const { data: existing, error: fetchError } = await supabase
      .from('workflows')
      .select('config')
      .eq('id', workflowId)
      .single();

    if (fetchError || !existing) {
      return {
        success: false,
        errors: {},
        formData: data,
        globalError: 'workflowNotFound',
      };
    }

    const updatedConfig = {
      ...(existing.config as Record<string, unknown>),
      params: parsedParams,
    };

    const { error } = await supabase
      .from('workflows')
      .update({
        name: parsed.data.name.trim(),
        description: parsed.data.description?.trim() || null,
        type: parsed.data.type,
        webhook_url: parsed.data.webhook_url.trim(),
        has_knowledge_base: parsed.data.has_knowledge_base,
        is_active: parsed.data.is_active,
        config: updatedConfig,
      })
      .eq('id', workflowId);

    if (error) throw error;

    logger.info('Workflow updated', { adminId: session.user.id, workflowId });
    revalidatePath('/admin/workflow');
    revalidatePath(`/admin/workflow/${workflowId}`);
  } catch (error) {
    logger.error('Error updating workflow', { error: (error as Error).message });
    return {
      success: false,
      errors: {},
      formData: {
        name: formData.get('name')?.toString() ?? '',
        description: formData.get('description')?.toString() ?? '',
        type: (formData.get('type')?.toString() ?? 'chat') as WorkflowType,
        webhook_url: formData.get('webhook_url')?.toString() ?? '',
        has_knowledge_base: formData.get('has_knowledge_base') === 'on',
        is_active: formData.get('is_active') !== 'off',
        params_json: formData.get('params_json')?.toString() ?? '',
      },
      globalError: 'unexpectedError',
    };
  }
  redirect(`/admin/workflow/${workflowId}?message=workflowUpdatedSuccess`);
}

export async function deleteWorkflowAction(workflowId: string) {
  try {
    const session = await checkAdminAuth();

    const supabase = createAdminClient();
    const { error } = await supabase
      .from('workflows')
      .delete()
      .eq('id', workflowId);

    if (error) throw error;

    logger.info('Workflow deleted', { adminId: session.user.id, workflowId });
    revalidatePath('/admin/workflow');

    return { success: true };
  } catch (error) {
    logger.error('Error deleting workflow', { error: (error as Error).message });
    throw error;
  }
}

// ============================================================
// Admin: Assignments
// ============================================================

export async function assignWorkflowToUserAction(
  prevState: AssignWorkflowFormState,
  formData: FormData
): Promise<AssignWorkflowFormState> {
  try {
    const session = await checkAdminAuth();

    const data = {
      user_id: formData.get('user_id')?.toString() ?? '',
      workflow_id: formData.get('workflow_id')?.toString() ?? '',
    };

    const parsed = assignWorkflowSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        errors: formatZodErrors(parsed.error),
        formData: data,
        globalError: null,
      };
    }

    const supabase = createAdminClient();
    const { error } = await supabase.from('user_workflows').upsert(
      {
        user_id: parsed.data.user_id,
        workflow_id: parsed.data.workflow_id,
        assigned_by: session.user.id,
      },
      { onConflict: 'user_id,workflow_id' }
    );

    if (error) throw error;

    logger.info('Workflow assigned', {
      adminId: session.user.id,
      userId: parsed.data.user_id,
      workflowId: parsed.data.workflow_id,
    });

    revalidatePath(`/admin/workflow/${parsed.data.workflow_id}`);

    return { success: true, errors: {}, formData: data, globalError: null };
  } catch (error) {
    logger.error('Error assigning workflow', { error: (error as Error).message });
    return {
      success: false,
      errors: {},
      formData: {
        user_id: formData.get('user_id')?.toString() ?? '',
        workflow_id: formData.get('workflow_id')?.toString() ?? '',
      },
      globalError: 'unexpectedError',
    };
  }
}

export async function unassignWorkflowFromUserAction(
  userId: string,
  workflowId: string
) {
  try {
    await checkAdminAuth();

    const supabase = createAdminClient();
    const { error } = await supabase
      .from('user_workflows')
      .delete()
      .eq('user_id', userId)
      .eq('workflow_id', workflowId);

    if (error) throw error;

    revalidatePath(`/admin/workflow/${workflowId}`);
    return { success: true };
  } catch (error) {
    logger.error('Error unassigning workflow', { error: (error as Error).message });
    throw error;
  }
}

// ============================================================
// Admin: Data fetches
// ============================================================

export async function getWorkflowById(workflowId: string): Promise<Workflow | false> {
  try {
    await checkAdminAuth();

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', workflowId)
      .single();

    if (error || !data) return false;
    return mapWorkflow(data as Record<string, unknown>);
  } catch (error) {
    logger.error('Error fetching workflow', { error: (error as Error).message });
    throw error;
  }
}

export async function getWorkflowsWithPagination(
  params: GetWorkflowsParams
): Promise<GetWorkflowsResult> {
  try {
    await checkAdminAuth();

    const page = parseInt(params.page || '1');
    const limit = parseInt(params.limit || '10');
    const search = params.search || '';
    const typeFilter = params.typeFilter || 'all';
    const sortField = params.sortField || 'created_at';
    const sortDirection = (params.sortDirection as 'asc' | 'desc') || 'desc';
    const offset = (page - 1) * limit;

    const supabase = createAdminClient();
    let query = supabase
      .from('workflows')
      .select('*', { count: 'exact' });

    if (search) {
      const safe = search.replace(/[,.()]/g, '');
      query = query.or(`name.ilike.%${safe}%,description.ilike.%${safe}%`);
    }
    if (typeFilter !== 'all') query = query.eq('type', typeFilter);

    const dbSort = sortField === 'createdAt' ? 'created_at'
      : sortField === 'updatedAt' ? 'updated_at'
      : sortField;

    query = query.order(dbSort, { ascending: sortDirection === 'asc' });
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    const workflows = (data || []).map((w) => mapWorkflow(w as Record<string, unknown>));
    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / limit);

    return { workflows, totalCount, totalPages, currentPage: page, limit };
  } catch (error) {
    logger.error('Error fetching workflows', { error: (error as Error).message });
    throw error;
  }
}

export async function getWorkflowAssignments(
  workflowId: string
): Promise<WorkflowAssignment[]> {
  try {
    await checkAdminAuth();

    const supabase = createAdminClient();
    // Fetch assignments
    const { data: assignments, error } = await supabase
      .from('user_workflows')
      .select('user_id, workflow_id, assigned_at, assigned_by')
      .eq('workflow_id', workflowId);

    if (error) throw error;

    // Fetch profiles separately to avoid ambiguous FK join
    const userIds = (assignments || []).map((a) => a.user_id);
    let profileMap: Record<string, { id: string; first_name: string | null; last_name: string | null; email: string }> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', userIds);

      profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
    }

    return (assignments || []).map((row) => {
      const profile = profileMap[row.user_id];
      return {
        userId: row.user_id,
        workflowId: row.workflow_id,
        assignedAt: new Date(row.assigned_at),
        assignedBy: row.assigned_by ?? null,
        user: {
          id: row.user_id,
          firstName: profile?.first_name ?? null,
          lastName: profile?.last_name ?? null,
          email: profile?.email ?? '',
        },
      };
    });
  } catch (error) {
    logger.error('Error fetching assignments', { error: (error as Error).message });
    throw error;
  }
}

// ============================================================
// User: fetch own assigned workflows (no admin check — RLS enforced)
// ============================================================

export async function getUserWorkflows(): Promise<Workflow[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return (data || []).map((w) => mapWorkflow(w as Record<string, unknown>));
  } catch (error) {
    logger.error('Error fetching user workflows', { error: (error as Error).message });
    throw error;
  }
}

