import { getSession } from '@/lib/auth-session';
import { notFound } from 'next/navigation';
import { TriggerLogTable } from '@/components/admin/trigger-log-table';
import { getTriggerLogsWithPagination, getTriggerWorkflowsForFilter } from '@/server-actions/trigger-log';
import type { GetTriggerLogsParams } from '@/types/trigger-log';

interface TriggerHistoryPageProps {
  searchParams: Promise<GetTriggerLogsParams>;
}

export default async function TriggerHistoryPage({ searchParams }: TriggerHistoryPageProps) {
  const session = await getSession();

  if (!session) {
    notFound();
  }

  const params = await searchParams;
  const [{ logs, totalCount, totalPages, currentPage, limit }, workflows] = await Promise.all([
    getTriggerLogsWithPagination(params),
    getTriggerWorkflowsForFilter(),
  ]);

  return (
    <div className="container mx-auto py-6">
      <TriggerLogTable
        logs={logs}
        totalCount={totalCount}
        totalPages={totalPages}
        currentPage={currentPage}
        limit={limit}
        sortField={params.sortField || 'created_at'}
        sortDirection={(params.sortDirection as 'asc' | 'desc') || 'desc'}
        searchTerm={params.search || ''}
        workflowFilter={params.workflowFilter || 'all'}
        statusFilter={params.statusFilter || 'all'}
        workflows={workflows}
      />
    </div>
  );
}
