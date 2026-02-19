# Next Launch Kit

A [Next.js 16](https://nextjs.org) full-stack starter kit with Supabase, Stripe, and internationalization.

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/docs) with App Router & Turbopack
- **Authentication**: [Supabase Auth](https://supabase.com/docs/guides/auth) (Email/Password + Google OAuth)
- **Database**: [Supabase PostgreSQL](https://supabase.com/docs/guides/database) with Row Level Security
- **Styling/UI**: [TailwindCSS 4](https://tailwindcss.com/docs) with [shadcn/ui](https://ui.shadcn.com/docs) components
- **Payments**: [Stripe](https://stripe.com/docs) (subscriptions, checkout, portal)
- **Validation**: [Zod](https://zod.dev)
- **Logging**: [Winston](https://github.com/winstonjs/winston#documentation)
- **i18n**: [next-intl](https://next-intl.dev) (English/Greek)
- **TypeScript**: [TypeScript 5.9](https://www.typescriptlang.org/docs/)

## Prerequisites

- [Node.js](https://nodejs.org/) v20+
- A [Supabase](https://supabase.com) project (free tier works)
- A [Stripe](https://stripe.com) account (for payments)

## Quick Start

1. **Clone the repository**

   ```bash
   git clone https://github.com/TeoMastro/next-launch-kit.git
   cd next-launch-kit
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up Supabase**

   - Create a project at [supabase.com](https://supabase.com)
   - Go to **Project Settings → API** and copy your keys
   - Create `.env.local` from the example:

   ```bash
   cp .env.example .env.local
   ```

   Fill in your credentials:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

4. **Run the database migration**

   - Open **Supabase Dashboard → SQL Editor**
   - Paste the contents of `supabase/migrations/001_initial.sql` and run it

5. **Seed the database**

   ```bash
   npm run db:seed
   ```

6. **Start the dev server**

   ```bash
   npm run dev
   ```

   Navigate to [http://localhost:3000](http://localhost:3000) and sign in with a demo account.

## Demo Accounts

After running the seed script, you can log in with these demo accounts:

- **Admin User**:
  - Email: `admin@nextlaunchkit.com`
  - Password: `demoadmin!1`
  - Role: ADMIN

- **Regular User**:
  - Email: `user@nextlaunchkit.com`
  - Password: `demouser!1`
  - Role: USER

## Google Sign In

1. Go to **Supabase Dashboard → Authentication → Providers → Google**
2. Enable the Google provider
3. Follow the instructions to set up OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/)
4. Add the Supabase callback URL to your Google OAuth settings

## Package Scripts

```bash
# Development
npm run dev              # Start dev server with Turbopack
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint

# Database
npm run db:seed          # Seed database with demo users

# Formatting
npm run format           # Format all files with Prettier
npm run format:check     # Check formatting without changes
```

## Environment Variables

Required in `.env.local` (see `.env.example`):

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public/anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `NEXT_PUBLIC_APP_URL` | Your app URL (e.g. `http://localhost:3000`) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID` | Stripe monthly price ID |
| `NEXT_PUBLIC_STRIPE_YEARLY_PRICE_ID` | Stripe yearly price ID |

## Translations

To alphabetically sort translations, copy and paste the contents of your messages JSON file [here](https://novicelab.org/jsonabc/). Then paste it back in the project file.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
