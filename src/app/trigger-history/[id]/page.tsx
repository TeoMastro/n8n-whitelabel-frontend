import { getSession } from '@/lib/auth-session';
import { notFound } from 'next/navigation';
import { getTriggerLogDetail } from '@/server-actions/trigger-log';
import { TriggerLogView } from '@/components/admin/trigger-log-view';

interface TriggerLogPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function TriggerLogPage({ params }: TriggerLogPageProps) {
  const session = await getSession();

  if (!session) {
    notFound();
  }

  const { id } = await params;

  try {
    const logDetails = await getTriggerLogDetail(id);

    return (
      <div className="container mx-auto py-6">
        <TriggerLogView
          log={logDetails}
        />
      </div>
    );
  } catch (error) {
    // If log is not found or unauthorized (due to RLS emulation in the action)
    notFound();
  }
}
