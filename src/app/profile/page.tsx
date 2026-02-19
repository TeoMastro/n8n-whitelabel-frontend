import { getSession } from '@/lib/auth-session';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Status } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function ProfilePage() {
  const session = await getSession();
  if (!session || session?.user.status !== Status.ACTIVE) {
    redirect('/auth/signin');
  }
  const t = await getTranslations('app');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('userInformation')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p>
            <strong>{t('id')}:</strong> {session?.user.id}
          </p>
          <p>
            <strong>{t('name')}:</strong> {`${session?.user.first_name || ''} ${session?.user.last_name || ''}`.trim()}
          </p>
          <p>
            <strong>Email:</strong> {session?.user.email}
          </p>
          <p>
            <strong>{t('role')}:</strong> {session?.user.role}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('accountDetails')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p>
            <strong>{t('accountType')}:</strong> {session?.user.role}
          </p>
          <p>
            <strong>{t('status')}:</strong>{' '}
            <span className="text-green-600">{t('active')}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

