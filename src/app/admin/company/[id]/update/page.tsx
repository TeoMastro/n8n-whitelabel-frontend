import { getSession } from '@/lib/auth-session';
import { notFound } from 'next/navigation';
import { CompanyForm } from '@/components/admin/company-form';
import { getCompanyById } from '@/server-actions/company';

export default async function UpdateCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();

  if (!session || session.user.role !== 'ADMIN') {
    notFound();
  }

  const { id } = await params;
  const company = await getCompanyById(id);

  if (!company) notFound();

  return (
    <div className="container mx-auto py-6">
      <CompanyForm mode="update" company={company} />
    </div>
  );
}
