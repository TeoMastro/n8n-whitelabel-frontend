import { getSession } from '@/lib/auth-session';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Role, Status } from '@/lib/constants';
import { getUserSubscriptionAction } from '@/server-actions/subscription';
import { SubscriptionCard } from '@/components/subscription/subscription-card';
import { PricingPlans } from '@/components/subscription/pricing-plans';
import { hasValidSubscription } from '@/lib/subscription-helpers';

export default async function DashboardPage() {
  const session = await getSession();

  if (!session || session?.user.status !== Status.ACTIVE) {
    redirect('/auth/signin');
  }

  const t = await getTranslations('app');
  const subscription = await getUserSubscriptionAction();
  const isUserRole = session.user.role === Role.USER;
  const hasActiveSub = subscription
    ? hasValidSubscription(subscription)
    : false;

  return (
    <div className="container mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          {t('welcomeBackName', { name: `${session.user.first_name || ''} ${session.user.last_name || ''}`.trim() || session.user.email })}
        </h1>
      </div>

      {isUserRole && (
        <div className="grid gap-6 md:grid-cols-2">
          <SubscriptionCard subscription={subscription} />
        </div>
      )}

      {isUserRole && !hasActiveSub && (
        <div>
          <PricingPlans hasActiveSubscription={hasActiveSub} />
        </div>
      )}
    </div>
  );
}
