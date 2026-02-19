import { SubscriptionStatus } from '@/lib/constants';

interface SubscriptionData {
  subscription_status: string | null;
  subscription_end_date: string | Date | null;
}

interface UserProfile extends SubscriptionData {
  role: string;
}

export function hasActiveSubscription(user: SubscriptionData): boolean {
  return user.subscription_status === SubscriptionStatus.active;
}

export function hasValidSubscription(user: SubscriptionData): boolean {
  if (!user.subscription_status) return false;

  const validStatuses: string[] = [
    SubscriptionStatus.active,
    SubscriptionStatus.trialing,
  ];

  return validStatuses.includes(user.subscription_status);
}

export function isPremiumUser(user: UserProfile): boolean {
  return hasValidSubscription(user);
}

export function isFreeUser(user: UserProfile): boolean {
  return !hasValidSubscription(user);
}

export function getSubscriptionStatusLabel(
  status: string | null
): string {
  if (!status) return 'free';

  switch (status) {
    case SubscriptionStatus.active:
      return 'subscriptionStatusActive';
    case SubscriptionStatus.canceled:
      return 'subscriptionStatusCanceled';
    case SubscriptionStatus.incomplete:
      return 'subscriptionStatusIncomplete';
    case SubscriptionStatus.incomplete_expired:
      return 'subscriptionStatusIncompleteExpired';
    case SubscriptionStatus.past_due:
      return 'subscriptionStatusPastDue';
    case SubscriptionStatus.trialing:
      return 'subscriptionStatusTrialing';
    case SubscriptionStatus.unpaid:
      return 'subscriptionStatusUnpaid';
    default:
      return 'subscriptionStatusUnknown';
  }
}

