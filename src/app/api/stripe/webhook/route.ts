import { NextRequest, NextResponse } from 'next/server';
import { stripe, STRIPE_CONFIG } from '@/lib/stripe';
import logger from '@/lib/logger';
import Stripe from 'stripe';
import { SubscriptionStatus } from '@/lib/constants';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    logger.error('Missing stripe-signature header');
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      STRIPE_CONFIG.webhookSecret
    );
  } catch (error) {
    logger.error('Webhook signature verification failed', {
      error: (error as Error).message,
    });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  logger.info('Webhook event received', {
    type: event.type,
    id: event.id,
  });

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription
        );
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription
        );
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(
          event.data.object as Stripe.Invoice
        );
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        logger.info('Unhandled webhook event type', { type: event.type });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error('Webhook handler error', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      eventType: event.type,
    });
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
) {
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;
  const userId = session.metadata?.userId;

  if (!userId) {
    logger.error('Missing userId in checkout session metadata', {
      sessionId: session.id,
    });
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  const currentPeriodEnd = subscription.items.data[0]?.current_period_end;

  if (!currentPeriodEnd) {
    logger.error('Missing current_period_end in subscription items', {
      subscriptionId,
      userId,
      itemsCount: subscription.items.data.length,
    });
    throw new Error('Invalid subscription: missing current_period_end');
  }

  const endDate = new Date(currentPeriodEnd * 1000);

  const supabaseAdmin = createAdminClient();

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      subscription_status: subscription.status as SubscriptionStatus,
      subscription_end_date: endDate.toISOString(),
    })
    .eq('id', userId);

  if (error) {
    logger.error('Failed to update profile after checkout', {
      userId,
      error: error.message,
    });
    throw error;
  }

  logger.info('Checkout session completed', {
    userId,
    customerId,
    subscriptionId,
    status: subscription.status,
    endDate: endDate.toISOString(),
  });
}

async function handleSubscriptionUpdated(
  subscriptionFromWebhook: Stripe.Subscription
) {
  const customerId = subscriptionFromWebhook.customer as string;

  const supabaseAdmin = createAdminClient();

  const { data: user } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!user) {
    logger.error('User not found for subscription update', {
      customerId,
      subscriptionId: subscriptionFromWebhook.id,
    });
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(
    subscriptionFromWebhook.id
  );

  const currentPeriodEnd = subscription.items.data[0]?.current_period_end;

  if (!currentPeriodEnd) {
    logger.error('Missing current_period_end in subscription items', {
      subscriptionId: subscription.id,
      userId: user.id,
      itemsCount: subscription.items.data.length,
    });
    throw new Error('Invalid subscription: missing current_period_end');
  }

  const endDate = new Date(currentPeriodEnd * 1000);

  await supabaseAdmin
    .from('profiles')
    .update({
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status as SubscriptionStatus,
      subscription_end_date: endDate.toISOString(),
    })
    .eq('id', user.id);

  logger.info('Subscription updated', {
    userId: user.id,
    subscriptionId: subscription.id,
    status: subscription.status,
    endDate: endDate.toISOString(),
  });
}

async function handleSubscriptionDeleted(
  subscriptionFromWebhook: Stripe.Subscription
) {
  const customerId = subscriptionFromWebhook.customer as string;

  const supabaseAdmin = createAdminClient();

  const { data: user } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!user) {
    logger.error('User not found for subscription deletion', {
      customerId,
      subscriptionId: subscriptionFromWebhook.id,
    });
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(
    subscriptionFromWebhook.id
  );

  const currentPeriodEnd = subscription.items.data[0]?.current_period_end;

  if (!currentPeriodEnd) {
    logger.error('Missing current_period_end in subscription items', {
      subscriptionId: subscription.id,
      userId: user.id,
      itemsCount: subscription.items.data.length,
    });
    throw new Error('Invalid subscription: missing current_period_end');
  }

  const endDate = new Date(currentPeriodEnd * 1000);

  await supabaseAdmin
    .from('profiles')
    .update({
      subscription_status: SubscriptionStatus.canceled,
      subscription_end_date: endDate.toISOString(),
    })
    .eq('id', user.id);

  logger.info('Subscription deleted', {
    userId: user.id,
    subscriptionId: subscription.id,
    endDate: endDate.toISOString(),
  });
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const subDetails = invoice.parent?.subscription_details;
  const subscriptionId = subDetails
    ? typeof subDetails.subscription === 'string'
      ? subDetails.subscription
      : subDetails.subscription?.id
    : undefined;

  if (!subscriptionId) {
    return;
  }

  const supabaseAdmin = createAdminClient();

  const { data: user } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!user) {
    logger.error('User not found for invoice payment', {
      customerId,
      invoiceId: invoice.id,
    });
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  const currentPeriodEnd = subscription.items.data[0]?.current_period_end;

  if (!currentPeriodEnd) {
    logger.error('Missing current_period_end in subscription items', {
      subscriptionId: subscription.id,
      userId: user.id,
      itemsCount: subscription.items.data.length,
    });
    throw new Error('Invalid subscription: missing current_period_end');
  }

  const endDate = new Date(currentPeriodEnd * 1000);

  await supabaseAdmin
    .from('profiles')
    .update({
      subscription_status: SubscriptionStatus.active,
      subscription_end_date: endDate.toISOString(),
    })
    .eq('id', user.id);

  logger.info('Invoice payment succeeded', {
    userId: user.id,
    invoiceId: invoice.id,
    subscriptionId,
    endDate: endDate.toISOString(),
  });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const supabaseAdmin = createAdminClient();

  const { data: user } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!user) {
    logger.error('User not found for failed payment', {
      customerId,
      invoiceId: invoice.id,
    });
    return;
  }

  await supabaseAdmin
    .from('profiles')
    .update({
      subscription_status: SubscriptionStatus.past_due,
    })
    .eq('id', user.id);

  logger.info('Invoice payment failed', {
    userId: user.id,
    invoiceId: invoice.id,
  });
}
