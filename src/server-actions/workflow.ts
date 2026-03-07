'use server';

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-session';
import { revalidatePath } from 'next/cache';
import { Role, WorkflowType } from '@/lib/constants';
import {
  createWorkflowSchema,
  updateWorkflowSchema,
  formatZodErrors,
} from '@/lib/validation-schemas';
import logger from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type {
  Workflow,
  WorkflowFormState,
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
    companyId: w.company_id as string,
    companyName: (w as any).companies?.name ?? undefined,
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
      company_id: formData.get('company_id')?.toString() ?? '',
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

    const { data: newWorkflow, error } = await supabase.from('workflows').insert({
      company_id: parsed.data.company_id,
      name: parsed.data.name.trim(),
      description: parsed.data.description?.trim() || null,
      type: parsed.data.type,
      webhook_url: parsed.data.webhook_url.trim(),
      has_knowledge_base: parsed.data.has_knowledge_base,
      is_active: parsed.data.is_active,
      config,
      created_by: session.user.id,
    }).select('id').single();

    if (error) throw error;

    // If knowledge base is enabled, create a partition for this workflow
    if (parsed.data.has_knowledge_base && newWorkflow) {
      const shortId = newWorkflow.id.replace(/-/g, '_');
      const partitionSql = `
        CREATE TABLE IF NOT EXISTS public.knowledge_base_wf_${shortId}
          PARTITION OF public.knowledge_base
          FOR VALUES IN ('${newWorkflow.id}');
        CREATE INDEX IF NOT EXISTS kb_wf_${shortId}_embedding_idx
          ON public.knowledge_base_wf_${shortId}
          USING hnsw (embedding vector_cosine_ops);
      `;
      // Execute DDL via the admin client's rpc or raw SQL
      const { error: partitionError } = await supabase.rpc('exec_sql', { sql: partitionSql });
      if (partitionError) {
        logger.warn('Failed to create KB partition (may need manual creation)', {
          workflowId: newWorkflow.id,
          error: partitionError.message,
        });
      }
    }

    logger.info('Workflow created', { adminId: session.user.id });
    revalidatePath('/admin/workflow');
  } catch (error) {
    logger.error('Error creating workflow', { error: (error as Error).message });
    return {
      success: false,
      errors: {},
      formData: {
        company_id: formData.get('company_id')?.toString() ?? '',
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
      company_id: formData.get('company_id')?.toString() ?? '',
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
        company_id: parsed.data.company_id,
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
        company_id: formData.get('company_id')?.toString() ?? '',
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

    // Try to drop KB partition if it exists
    const shortId = workflowId.replace(/-/g, '_');
    const dropSql = `DROP TABLE IF EXISTS public.knowledge_base_wf_${shortId};`;
    try {
      await supabase.rpc('exec_sql', { sql: dropSql });
    } catch {
      // Ignore errors — partition may not exist
    }

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
// Admin: Data fetches
// ============================================================

export async function getWorkflowById(workflowId: string): Promise<Workflow | false> {
  try {
    await checkAdminAuth();

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('workflows')
      .select('*, companies(name)')
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
    const companyFilter = params.companyFilter || '';
    const sortField = params.sortField || 'created_at';
    const sortDirection = (params.sortDirection as 'asc' | 'desc') || 'desc';
    const offset = (page - 1) * limit;

    const supabase = createAdminClient();
    let query = supabase
      .from('workflows')
      .select('*, companies(name)', { count: 'exact' });

    if (search) {
      const safe = search.replace(/[,.()]/g, '');
      query = query.or(`name.ilike.%${safe}%,description.ilike.%${safe}%`);
    }
    if (typeFilter !== 'all') query = query.eq('type', typeFilter);
    if (companyFilter) query = query.eq('company_id', companyFilter);

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

// ============================================================
// User: fetch own assigned workflows (no admin check — RLS enforced)
// ============================================================

export async function getUserWorkflows(): Promise<Workflow[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('workflows')
      .select('*, companies(name)')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return (data || []).map((w) => mapWorkflow(w as Record<string, unknown>));
  } catch (error) {
    logger.error('Error fetching user workflows', { error: (error as Error).message });
    throw error;
  }
}
