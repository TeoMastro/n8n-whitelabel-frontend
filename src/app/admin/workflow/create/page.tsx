import { getSession } from '@/lib/auth-session';
import { notFound } from 'next/navigation';
import { WorkflowForm } from '@/components/admin/workflow-form';
import { getAllCompanies } from '@/server-actions/company';

export default async function CreateWorkflowPage() {
  const session = await getSession();

  if (!session || session.user.role !== 'ADMIN') {
    notFound();
  }

  const companies = await getAllCompanies();

  return (
    <div className="container mx-auto py-6">
      <WorkflowForm mode="create" companies={companies} />
    </div>
  );
}
