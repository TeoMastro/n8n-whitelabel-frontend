import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit } from 'lucide-react';
import { CompanyViewProps } from '@/types/company';
import { CompanyDeleteButton } from './company-delete-button';
import { CompanyAssignments } from './company-assignments';
import Link from 'next/link';

export function CompanyView({ company, assignments, users = [] }: CompanyViewProps) {
  const t = useTranslations('app');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/company">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">{company.name}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/admin/company/${company.id}/update`}>
              <Edit className="h-4 w-4" />
            </Link>
          </Button>
          <CompanyDeleteButton companyId={company.id} companyName={company.name} />
        </div>
      </div>

      {/* Company Details */}
      <Card>
        <CardHeader>
          <CardTitle>{t('companyDetails')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {company.note && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t('companyNote')}</label>
              <p className="mt-1">{company.note}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t('createdAt')}</label>
              <p className="mt-1 text-sm">{new Date(company.createdAt).toLocaleDateString()}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t('updatedAt')}</label>
              <p className="mt-1 text-sm">{new Date(company.updatedAt).toLocaleDateString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assignments */}
      <Card>
        <CardHeader>
          <CardTitle>{t('assignedUsers')}</CardTitle>
        </CardHeader>
        <CardContent>
          <CompanyAssignments companyId={company.id} assignments={assignments} users={users} />
        </CardContent>
      </Card>
    </div>
  );
}
