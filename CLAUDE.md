# Next Launch Kit - Project Guide

This is a Next.js 16 full-stack application with Supabase authentication, user management, Stripe subscriptions, and internationalization.

## Tech Stack

- **Framework**: Next.js 16 with App Router, React 19, TypeScript
- **Database**: Supabase PostgreSQL with Row Level Security (RLS)
- **Authentication**: Supabase Auth (email/password + Google OAuth)
- **Payments**: Stripe (subscriptions, checkout, customer portal)
- **Styling**: Tailwind CSS 4, shadcn/ui components
- **Validation**: Zod schemas
- **Logging**: Winston
- **i18n**: next-intl (English/Greek)

## Key Commands

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run db:seed` - Seed database with demo users

## Project Structure

- `/src/app` - Next.js App Router pages and API routes
- `/src/components` - React components (UI, auth, admin, layout, subscription)
- `/src/server-actions` - Server actions for data mutations
- `/src/lib` - Utilities (supabase clients, validation, logging, constants, stripe)
- `/src/lib/supabase` - Supabase client helpers (client.ts, server.ts, admin.ts, middleware.ts)
- `/src/types` - TypeScript type definitions
- `/supabase` - SQL migrations and seed script
- `/messages` - i18n translation files (en.json, el.json)

## Code Standards

- Use TypeScript with strict mode enabled
- Server Components by default; add `'use client'` only when necessary
- Server actions in `/src/server-actions` for mutations
- All forms use `useActionState` hook for form state management
- Zod schemas in `/src/lib/validation-schemas.ts` for validation
- Error messages as translation keys, translated via next-intl
- Supabase for all database operations via query builder
- Logger for server-side logging via `/src/lib/logger.ts`

## Supabase Clients

Three Supabase client helpers for different contexts:

- **Browser client** (`/src/lib/supabase/client.ts`) - Used in `'use client'` components
- **Server client** (`/src/lib/supabase/server.ts`) - Used in Server Components and Server Actions (respects RLS)
- **Admin client** (`/src/lib/supabase/admin.ts`) - Uses service role key, bypasses RLS (for admin operations)

## Authentication & Authorization

- Supabase Auth handles sign-up, sign-in, password reset, email verification
- Proxy middleware in `/src/proxy.ts` protects routes and refreshes sessions
- User roles: `USER`, `ADMIN` (stored in `profiles.role`)
- User status: `ACTIVE`, `INACTIVE`, `UNVERIFIED` (stored in `profiles.status`)
- Admin routes: `/admin/*` - only accessible to ADMIN role
- Protected routes: `/dashboard`, `/profile`, `/settings` - require authentication
- Auth callback route: `/auth/callback` handles OAuth and email verification redirects

## Database

- Supabase PostgreSQL with RLS enabled on `profiles` table
- `profiles` table linked to `auth.users` via UUID foreign key
- User IDs are UUID strings (not integers)
- Admin queries use the admin client to bypass RLS
- Regular queries use the server client (RLS enforced)
- `is_admin()` SECURITY DEFINER function prevents RLS recursion
- Use `revalidatePath()` after mutations that affect UI

## Form Patterns

All forms follow this pattern:

```typescript
// Define state type
type FormState = {
  success: boolean;
  errors: Record<string, string[]>;
  formData: { /* form fields */ };
  globalError: string | null;
};

// Use useActionState hook
const [state, formAction] = useActionState(serverAction, initialState);

// Server action validates with Zod, returns FormState
// Translation keys used for error messages
```

## Translation System

- Locale stored in cookies
- Translation files: `/messages/en.json`, `/messages/el.json`
- Server: `getTranslations('namespace')` from `next-intl/server`
- Client: `useTranslations('namespace')` from `next-intl`
- All user-facing strings must use translation keys

## Component Conventions

- shadcn/ui components in `/src/components/ui`
- Use existing UI components, don't create custom ones
- InfoAlert component for success/error/warning messages
- All admin tables use sortable headers, pagination, filters

## Server Actions

- Located in `/src/server-actions`
- Always validate with Zod schemas
- Return FormState objects for forms
- Use `redirect()` for successful mutations
- Log important actions with Winston logger
- Check admin authorization with `checkAdminAuth()` helper
- Use Supabase server client for user-scoped queries
- Use Supabase admin client for privileged operations

## Environment Variables

Required in `.env.local` (see `.env.example`):

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase public/anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-only)
- `NEXT_PUBLIC_APP_URL` - Application URL
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `NEXT_PUBLIC_STRIPE_*` - Stripe publishable key and price IDs

## Important Notes

- Never commit `.env.local` files
- User IDs are UUID strings, not integers
- Demo users: admin@nextlaunchkit.com / user@nextlaunchkit.com
- Email verification handled by Supabase Auth (via `/auth/callback` route)
- Password reset uses Supabase's built-in flow (no custom tokens)
- User deletion prevented for own account (admin)
- Prettier config: single quotes, 2 spaces, trailing commas
- Constants for Role, Status, SubscriptionStatus in `/src/lib/constants.ts`

## File Creation

When creating new files:

- Use existing patterns from similar files
- Place server actions in `/src/server-actions`
- Place types in `/src/types`
- Follow existing naming conventions (kebab-case for files)
- Add translation keys to both `/messages/en.json` and `/messages/el.json`
- Use Supabase query builder (not raw SQL) for database operations
