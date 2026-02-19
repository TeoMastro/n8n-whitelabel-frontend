'use server';

import { getSession } from '@/lib/auth-session';
import {
  stripe,
  getPriceId,
  PlanType,
  STRIPE_CONFIG,
  getSimulationTime,
} from '@/lib/stripe';
import logger from '@/lib/logger';
import { Role, Status } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';
import Stripe from 'stripe';

async function checkUserAuth() {
  const session = await getSession();

  if (!session || !session.user) {
    throw new Error('Unauthorized');
  }

  if (session.user.role !== Role.USER) {
    throw new Error('Only USER role can subscribe');
  }

  if (session.user.status !== Status.ACTIVE) {
    throw new Error('Only ACTIVE users can subscribe');
  }

  return session;
}

export async function createCheckoutSession(planType: PlanType) {
  try {
    const session = await checkUserAuth();
    const supabase = await createClient();

    const { data: user, error } = await supabase
      .from('profiles')
      .select('email, stripe_customer_id, first_name, last_name')
      .eq('id', session.user.id)
      .single();

    if (error || !user) {
      throw new Error('User not found');
    }

    const priceId = getPriceId(planType);

    if (!priceId) {
      throw new Error('Invalid plan type');
    }

    let customerId = user.stripe_customer_id;

    if (!customerId) {
      const customerData: Stripe.CustomerCreateParams = {
        email: user.email,
        name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        metadata: {
          userId: session.user.id,
        },
        ...(STRIPE_CONFIG.testClockId && {
          test_clock: STRIPE_CONFIG.testClockId,
        }),
      };

      const customer = await stripe.customers.create(customerData);

      customerId = customer.id;

      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', session.user.id);

      logger.info('Stripe customer created', {
        userId: session.user.id,
        customerId,
      });
    }

    const checkoutSessionData: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?canceled=true`,
      subscription_data: {
        description: `Subscription for user ${session.user.id}`,
        metadata: {
          userId: session.user.id,
          planType,
          ...(STRIPE_CONFIG.testClockId && {
            test_clock: STRIPE_CONFIG.testClockId,
          }),
        },
      },
      payment_method_collection: 'always',
      metadata: {
        userId: session.user.id,
        planType,
      },
    };

    const checkoutSession =
      await stripe.checkout.sessions.create(checkoutSessionData);

    logger.info('Checkout session created', {
      userId: session.user.id,
      sessionId: checkoutSession.id,
      planType,
    });

    return { url: checkoutSession.url };
  } catch (error) {
    logger.error('Error creating checkout session', {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    throw error;
  }
}

export async function createPortalSession() {
  try {
    const session = await checkUserAuth();
    const supabase = await createClient();

    const { data: user, error } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', session.user.id)
      .single();

    if (error || !user || !user.stripe_customer_id) {
      throw new Error('No Stripe customer found');
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    });

    logger.info('Portal session created', {
      userId: session.user.id,
      sessionId: portalSession.id,
    });

    return { url: portalSession.url };
  } catch (error) {
    logger.error('Error creating portal session', {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    throw error;
  }
}

export async function getUserSubscriptionAction() {
  try {
    const session = await getSession();

    if (!session || !session.user) {
      return null;
    }

    const supabase = await createClient();

    const { data: user, error } = await supabase
      .from('profiles')
      .select(
        'stripe_customer_id, stripe_subscription_id, subscription_status, subscription_end_date'
      )
      .eq('id', session.user.id)
      .single();

    if (error) {
      return null;
    }

    return user;
  } catch (error) {
    logger.error('Error fetching user subscription', {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    return null;
  }
}

export async function getSimulationTimeAction() {
  try {
    const simulationTime = await getSimulationTime();
    const hasTestClock = !!STRIPE_CONFIG.testClockId;

    return {
      success: true,
      simulationTime: simulationTime.toISOString(),
      hasTestClock,
      testClockId: STRIPE_CONFIG.testClockId || null,
    };
  } catch (error) {
    logger.error('Error fetching simulation time', {
      error: (error as Error).message,
    });
    return {
      success: false,
      simulationTime: new Date().toISOString(),
      hasTestClock: false,
      testClockId: null,
    };
  }
}

export async function syncSubscriptionAction() {
  try {
    const session = await checkUserAuth();
    const supabase = await createClient();

    const { data: user, error } = await supabase
      .from('profiles')
      .select('stripe_subscription_id, stripe_customer_id')
      .eq('id', session.user.id)
      .single();

    if (error || !user || !user.stripe_subscription_id) {
      return {
        success: false,
        error: 'No active subscription found',
      };
    }

    const subscription = await stripe.subscriptions.retrieve(
      user.stripe_subscription_id
    );

    const currentPeriodEnd =
      subscription.items.data[0]?.current_period_end;
    if (!currentPeriodEnd) {
      return {
        success: false,
        error: 'Missing current_period_end in subscription',
      };
    }
    const endDate = new Date(currentPeriodEnd * 1000);

    await supabase
      .from('profiles')
      .update({
        subscription_status: subscription.status,
        subscription_end_date: endDate.toISOString(),
      })
      .eq('id', session.user.id);

    logger.info('Subscription synced manually', {
      userId: session.user.id,
      subscriptionId: subscription.id,
      status: subscription.status,
      endDate: endDate.toISOString(),
    });

    return {
      success: true,
      status: subscription.status,
      endDate: endDate.toISOString(),
    };
  } catch (error) {
    logger.error('Error syncing subscription', {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}
