import { getSession } from '@/lib/auth-session';
import { notFound } from 'next/navigation';
import { WorkflowTable } from '@/components/admin/workflow-table';
import { getWorkflowsWithPagination } from '@/server-actions/workflow';
import { AdminWorkflowPageProps } from '@/types/workflow';

export default async function AdminWorkflowsPage({ searchParams }: AdminWorkflowPageProps) {
  const session = await getSession();

  if (!session || session.user.role !== 'ADMIN') {
    notFound();
  }

  const params = await searchParams;
  const { workflows, totalCount, totalPages, currentPage, limit } =
    await getWorkflowsWithPagination(params);

  return (
    <div className="container mx-auto py-6">
      <WorkflowTable
        workflows={workflows}
        totalCount={totalCount}
        totalPages={totalPages}
        currentPage={currentPage}
        limit={limit}
        sortField={params.sortField || 'createdAt'}
        sortDirection={(params.sortDirection as 'asc' | 'desc') || 'desc'}
        searchTerm={params.search || ''}
        typeFilter={params.typeFilter || 'all'}
      />
    </div>
  );
}
