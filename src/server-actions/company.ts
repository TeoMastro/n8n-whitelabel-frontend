'use server';

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-session';
import { revalidatePath } from 'next/cache';
import { Role } from '@/lib/constants';
import {
  createCompanySchema,
  updateCompanySchema,
  assignUserToCompanySchema,
  formatZodErrors,
} from '@/lib/validation-schemas';
import logger from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';
import type {
  Company,
  CompanyFormState,
  AssignUserToCompanyFormState,
  GetCompaniesParams,
  GetCompaniesResult,
} from '@/types/company';

async function checkAdminAuth() {
  const session = await getSession();
  if (!session || session.user.role !== Role.ADMIN) {
    throw new Error('Unauthorized');
  }
  return session;
}

function mapCompany(c: Record<string, unknown>): Company {
  return {
    id: c.id as string,
    name: c.name as string,
    note: (c.note as string | null) ?? null,
    createdAt: new Date(c.created_at as string),
    updatedAt: new Date(c.updated_at as string),
  };
}

// ============================================================
// Admin: CRUD
// ============================================================

export async function createCompanyAction(
  prevState: CompanyFormState,
  formData: FormData
): Promise<CompanyFormState> {
  try {
    await checkAdminAuth();

    const data = {
      name: formData.get('name')?.toString() ?? '',
      note: formData.get('note')?.toString() ?? '',
    };

    const parsed = createCompanySchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        errors: formatZodErrors(parsed.error),
        formData: data,
        globalError: null,
      };
    }

    const supabase = createAdminClient();
    const { error } = await supabase.from('companies').insert({
      name: parsed.data.name.trim(),
      note: parsed.data.note?.trim() || null,
    });

    if (error) throw error;

    logger.info('Company created');
    revalidatePath('/admin/company');
  } catch (error) {
    logger.error('Error creating company', { error: (error as Error).message });
    return {
      success: false,
      errors: {},
      formData: {
        name: formData.get('name')?.toString() ?? '',
        note: formData.get('note')?.toString() ?? '',
      },
      globalError: 'unexpectedError',
    };
  }
  redirect('/admin/company?message=companyCreatedSuccess');
}

export async function updateCompanyAction(
  companyId: string,
  prevState: CompanyFormState,
  formData: FormData
): Promise<CompanyFormState> {
  try {
    await checkAdminAuth();

    const data = {
      name: formData.get('name')?.toString() ?? '',
      note: formData.get('note')?.toString() ?? '',
    };

    const parsed = updateCompanySchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        errors: formatZodErrors(parsed.error),
        formData: data,
        globalError: null,
      };
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from('companies')
      .update({
        name: parsed.data.name.trim(),
        note: parsed.data.note?.trim() || null,
      })
      .eq('id', companyId);

    if (error) throw error;

    logger.info('Company updated', { companyId });
    revalidatePath('/admin/company');
    revalidatePath(`/admin/company/${companyId}`);
  } catch (error) {
    logger.error('Error updating company', { error: (error as Error).message });
    return {
      success: false,
      errors: {},
      formData: {
        name: formData.get('name')?.toString() ?? '',
        note: formData.get('note')?.toString() ?? '',
      },
      globalError: 'unexpectedError',
    };
  }
  redirect(`/admin/company/${companyId}?message=companyUpdatedSuccess`);
}

export async function deleteCompanyAction(companyId: string) {
  try {
    const session = await checkAdminAuth();

    const supabase = createAdminClient();
    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('id', companyId);

    if (error) throw error;

    logger.info('Company deleted', { adminId: session.user.id, companyId });
    revalidatePath('/admin/company');

    return { success: true };
  } catch (error) {
    logger.error('Error deleting company', { error: (error as Error).message });
    throw error;
  }
}

// ============================================================
// Admin: User assignments
// ============================================================

export async function assignUserToCompanyAction(
  prevState: AssignUserToCompanyFormState,
  formData: FormData
): Promise<AssignUserToCompanyFormState> {
  try {
    const session = await checkAdminAuth();

    const data = {
      user_id: formData.get('user_id')?.toString() ?? '',
      company_id: formData.get('company_id')?.toString() ?? '',
    };

    const parsed = assignUserToCompanySchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        errors: formatZodErrors(parsed.error),
        formData: data,
        globalError: null,
      };
    }

    const supabase = createAdminClient();
    const { error } = await supabase.from('user_companies').upsert(
      {
        user_id: parsed.data.user_id,
        company_id: parsed.data.company_id,
        assigned_by: session.user.id,
      },
      { onConflict: 'user_id,company_id' }
    );

    if (error) throw error;

    logger.info('User assigned to company', {
      adminId: session.user.id,
      userId: parsed.data.user_id,
      companyId: parsed.data.company_id,
    });

    revalidatePath(`/admin/company/${parsed.data.company_id}`);

    return { success: true, errors: {}, formData: data, globalError: null };
  } catch (error) {
    logger.error('Error assigning user to company', { error: (error as Error).message });
    return {
      success: false,
      errors: {},
      formData: {
        user_id: formData.get('user_id')?.toString() ?? '',
        company_id: formData.get('company_id')?.toString() ?? '',
      },
      globalError: 'unexpectedError',
    };
  }
}

export async function unassignUserFromCompanyAction(
  userId: string,
  companyId: string
) {
  try {
    await checkAdminAuth();

    const supabase = createAdminClient();
    const { error } = await supabase
      .from('user_companies')
      .delete()
      .eq('user_id', userId)
      .eq('company_id', companyId);

    if (error) throw error;

    revalidatePath(`/admin/company/${companyId}`);
    return { success: true };
  } catch (error) {
    logger.error('Error unassigning user from company', { error: (error as Error).message });
    throw error;
  }
}

// ============================================================
// Admin: Data fetches
// ============================================================

export async function getCompanyById(companyId: string): Promise<Company | false> {
  try {
    await checkAdminAuth();

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    if (error || !data) return false;
    return mapCompany(data as Record<string, unknown>);
  } catch (error) {
    logger.error('Error fetching company', { error: (error as Error).message });
    throw error;
  }
}

export async function getCompaniesWithPagination(
  params: GetCompaniesParams
): Promise<GetCompaniesResult> {
  try {
    await checkAdminAuth();

    const page = parseInt(params.page || '1');
    const limit = parseInt(params.limit || '10');
    const search = params.search || '';
    const sortField = params.sortField || 'created_at';
    const sortDirection = (params.sortDirection as 'asc' | 'desc') || 'desc';
    const offset = (page - 1) * limit;

    const supabase = createAdminClient();
    let query = supabase
      .from('companies')
      .select('*', { count: 'exact' });

    if (search) {
      const safe = search.replace(/[,.()]/g, '');
      query = query.or(`name.ilike.%${safe}%,note.ilike.%${safe}%`);
    }

    const dbSort = sortField === 'createdAt' ? 'created_at'
      : sortField === 'updatedAt' ? 'updated_at'
      : sortField;

    query = query.order(dbSort, { ascending: sortDirection === 'asc' });
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    const companies = (data || []).map((c) => mapCompany(c as Record<string, unknown>));
    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / limit);

    return { companies, totalCount, totalPages, currentPage: page, limit };
  } catch (error) {
    logger.error('Error fetching companies', { error: (error as Error).message });
    throw error;
  }
}

export async function getAllCompanies(): Promise<{ id: string; name: string }[]> {
  try {
    await checkAdminAuth();

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('companies')
      .select('id, name')
      .order('name');

    if (error) throw error;
    return (data || []).map((c) => ({ id: c.id, name: c.name }));
  } catch (error) {
    logger.error('Error fetching all companies', { error: (error as Error).message });
    throw error;
  }
}

export async function getCompanyAssignments(
  companyId: string
): Promise<{ userId: string; firstName: string | null; lastName: string | null; email: string; assignedAt: Date; assignedBy: string | null }[]> {
  try {
    await checkAdminAuth();

    const supabase = createAdminClient();
    const { data: assignments, error } = await supabase
      .from('user_companies')
      .select('user_id, company_id, assigned_at, assigned_by')
      .eq('company_id', companyId);

    if (error) throw error;

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
        firstName: profile?.first_name ?? null,
        lastName: profile?.last_name ?? null,
        email: profile?.email ?? '',
        assignedAt: new Date(row.assigned_at),
        assignedBy: row.assigned_by ?? null,
      };
    });
  } catch (error) {
    logger.error('Error fetching company assignments', { error: (error as Error).message });
    throw error;
  }
}
