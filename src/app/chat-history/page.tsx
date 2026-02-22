import { getSession } from '@/lib/auth-session';
import { notFound } from 'next/navigation';
import { ChatSessionTable } from '@/components/admin/chat-session-table';
import { getChatSessionsWithPagination, getWorkflowsForFilter } from '@/server-actions/chat-log';
import type { GetChatSessionsParams } from '@/types/chat-log';

interface ChatHistoryPageProps {
  searchParams: Promise<GetChatSessionsParams>;
}

export default async function ChatHistoryPage({ searchParams }: ChatHistoryPageProps) {
  const session = await getSession();

  if (!session) {
    notFound();
  }

  const params = await searchParams;
  const [{ sessions, totalCount, totalPages, currentPage, limit }, workflows] = await Promise.all([
    getChatSessionsWithPagination(params),
    getWorkflowsForFilter(),
  ]);

  return (
    <div className="container mx-auto py-6">
      <ChatSessionTable
        sessions={sessions}
        totalCount={totalCount}
        totalPages={totalPages}
        currentPage={currentPage}
        limit={limit}
        sortField={params.sortField || 'lastMessageAt'}
        sortDirection={(params.sortDirection as 'asc' | 'desc') || 'desc'}
        searchTerm={params.search || ''}
        workflowFilter={params.workflowFilter || 'all'}
        workflows={workflows}
      />
    </div>
  );
}
