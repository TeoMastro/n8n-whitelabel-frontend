# Project Overview: Next Launch Kit

## Introduction
This document provides an overview of the "Next Launch Kit" project, a full-stack application template designed for rapid deployment of SaaS applications.

## Technology Stack

### Core Framework
- **Next.js 16**: Utilizes the App Router and Turbopack for development.
- **React 19**: The underlying UI library.
- **TypeScript 5.9**: Keeping type safety throughout the project.

### Database & Authentication
- **Supabase**: Handles database and authentication.
- **Row Level Security (RLS)**: Enforced for security.
- **Auth methods**: Email/Password + Google OAuth.


### Styling & UI
- **Tailwind CSS 4**: Utility-first CSS framework.
- **shadcn/ui**: Reusable UI components.
- **Lucide React**: Icon library.

### State Management & Validation
- **Server Actions**: For data mutations.
- **useActionState**: Form state management hook.
- **Zod**: Schema validation.

### Internationalization (i18n)
- **next-intl**: Handles translations (English, Greek).
- **Translation Files**: Located in `/messages`.

### Utilities
- **Winston**: Server-side logging.

## Project Structure

```text
├── src/
│   ├── app/              # Next.js App Router pages and API routes
│   ├── components/       # React components (UI, auth, admin, etc.)
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utilities (Supabase, logger, constants)
│   ├── server-actions/   # Server actions for mutations
│   ├── types/            # TypeScript type definitions
│   └── proxy.ts          # Middleware proxy implementation
├── messages/             # Translation files (en.json, el.json)
├── supabase/             # SQL migrations and seed scripts
├── public/               # Static assets
└── ...config files       # (next.config.ts, tailwind, etc.)
```

## Key Methodologies & Conventions

### 1. Server Components First
- Components are Server Components by default.
- `'use client'` is added only when client-side interactivity is required.

### 2. Form Handling
- All forms use the `useActionState` hook.
- Server actions return a `FormState` object containing:
  - `success`: boolean
  - `errors`: Field-specific messages
  - `globalError`: General error message
  - `formData`: Preserved input values

### 3. Database Access
- **Client-side**: Use `createClient` from `@supabase/supabase-js`.
- **Server-side (User)**: Use `createServerClient` (via `src/lib/supabase/server.ts`).
- **Server-side (Admin)**: Use administrative client (via `src/lib/supabase/admin.ts`).

### 4. Internationalization
- Content is translated using keys from `messages/*.json`.
- `getTranslations` used on the server, `useTranslations` on the client.

## Setup & Commands
- `npm run dev`: Start development server.
- `npm run db:seed`: Seed the database with demo users.
- `npm run lint`: Run code linting.
