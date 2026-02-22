import { getSession } from '@/lib/auth-session';
import { notFound } from 'next/navigation';
import { WorkflowView } from '@/components/admin/workflow-view';
import { getWorkflowById, getWorkflowAssignments } from '@/server-actions/workflow';
import { getDocumentsForWorkflow } from '@/server-actions/document';
import { WorkflowPageProps } from '@/types/workflow';

export default async function AdminWorkflowViewPage({ params }: WorkflowPageProps) {
  const session = await getSession();

  if (!session || session.user.role !== 'ADMIN') {
    notFound();
  }

  const { id } = await params;
  const [workflow, assignments] = await Promise.all([
    getWorkflowById(id),
    getWorkflowAssignments(id),
  ]);

  if (!workflow) notFound();

  const documents = workflow.hasKnowledgeBase
    ? await getDocumentsForWorkflow(workflow.id)
    : [];

  return (
    <div className="container mx-auto py-6">
      <WorkflowView workflow={workflow} assignments={assignments} documents={documents} />
    </div>
  );
}
