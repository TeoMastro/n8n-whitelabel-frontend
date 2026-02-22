-- Remove Stripe/subscription columns from profiles table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS stripe_subscription_id;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS subscription_status;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS subscription_end_date;
