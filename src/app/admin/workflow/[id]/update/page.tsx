import { getSession } from '@/lib/auth-session';
import { notFound } from 'next/navigation';
import { WorkflowForm } from '@/components/admin/workflow-form';
import { getWorkflowById } from '@/server-actions/workflow';
import { WorkflowPageProps } from '@/types/workflow';

export default async function UpdateWorkflowPage({ params }: WorkflowPageProps) {
  const session = await getSession();

  if (!session || session.user.role !== 'ADMIN') {
    notFound();
  }

  const { id } = await params;
  const workflow = await getWorkflowById(id);

  if (!workflow) notFound();

  return (
    <div className="container mx-auto py-6">
      <WorkflowForm mode="update" workflow={workflow} />
    </div>
  );
}
