// Replaces @prisma/client enums with plain string constants

export const Role = {
  USER: 'USER',
  ADMIN: 'ADMIN',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const Status = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  UNVERIFIED: 'UNVERIFIED',
} as const;

export type Status = (typeof Status)[keyof typeof Status];

export const SubscriptionStatus = {
  active: 'active',
  canceled: 'canceled',
  incomplete: 'incomplete',
  incomplete_expired: 'incomplete_expired',
  past_due: 'past_due',
  trialing: 'trialing',
  unpaid: 'unpaid',
} as const;

export type SubscriptionStatus =
  (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];
