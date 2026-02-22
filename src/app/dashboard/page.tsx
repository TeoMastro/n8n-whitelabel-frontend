import { getSession } from '@/lib/auth-session';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Status } from '@/lib/constants';

export default async function DashboardPage() {
  const session = await getSession();

  if (!session || session?.user.status !== Status.ACTIVE) {
    redirect('/auth/signin');
  }

  const t = await getTranslations('app');

  return (
    <div className="container mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          {t('welcomeBackName', { name: `${session.user.first_name || ''} ${session.user.last_name || ''}`.trim() || session.user.email })}
        </h1>
      </div>
    </div>
  );
}
