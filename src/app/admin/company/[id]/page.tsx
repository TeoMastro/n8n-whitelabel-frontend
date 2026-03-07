import { getSession } from '@/lib/auth-session';
import { notFound } from 'next/navigation';
import { CompanyView } from '@/components/admin/company-view';
import { getCompanyById, getCompanyAssignments } from '@/server-actions/company';
import { getAllUsersForExport } from '@/server-actions/user';

export default async function AdminCompanyViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();

  if (!session || session.user.role !== 'ADMIN') {
    notFound();
  }

  const { id } = await params;
  const [company, assignments, users] = await Promise.all([
    getCompanyById(id),
    getCompanyAssignments(id),
    getAllUsersForExport({}),
  ]);

  if (!company) notFound();

  return (
    <div className="container mx-auto py-6">
      <CompanyView company={company} assignments={assignments} users={users} />
    </div>
  );
}
