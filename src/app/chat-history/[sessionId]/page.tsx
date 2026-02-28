import { getSession } from '@/lib/auth-session';
import { notFound } from 'next/navigation';
import { ChatSessionView } from '@/components/admin/chat-session-view';
import { getChatSessionMessages } from '@/server-actions/chat-log';

interface ChatSessionPageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function ChatSessionPage({ params }: ChatSessionPageProps) {
  const session = await getSession();

  if (!session) {
    notFound();
  }

  const { sessionId } = await params;
  const decodedSessionId = decodeURIComponent(sessionId);

  const { messages, workflowName, totalCost } = await getChatSessionMessages(decodedSessionId);

  if (messages.length === 0) {
    notFound();
  }

  return (
    <div className="container mx-auto py-6">
      <ChatSessionView
        sessionId={decodedSessionId}
        workflowName={workflowName}
        totalCost={totalCost}
        messages={messages}
      />
    </div>
  );
}
