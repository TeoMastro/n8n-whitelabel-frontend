import { getSession } from '@/lib/auth-session';
import { notFound } from 'next/navigation';
import { WorkflowForm } from '@/components/admin/workflow-form';

export default async function CreateWorkflowPage() {
  const session = await getSession();

  if (!session || session.user.role !== 'ADMIN') {
    notFound();
  }

  return (
    <div className="container mx-auto py-6">
      <WorkflowForm mode="create" />
    </div>
  );
}
