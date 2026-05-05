# New Update Log App

SaaS foundation for a trucking operations platform.

## Stack

- Next.js App Router
- TypeScript
- Supabase Auth + Postgres
- Vercel-ready deployment

## Local Setup

1. Copy `.env.example` to `.env.local`.
2. Add Supabase project values:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=
RESEND_API_KEY=
INVITE_EMAIL_FROM=
```

3. Run `supabase/schema.sql` in Supabase SQL Editor.
4. Install dependencies:

```bash
npm install
```

5. Start the app:

```bash
npm run dev
```

## Current Foundation

- Email/password auth
- Protected app routes
- Company onboarding
- Owner/admin/dispatcher/viewer role model
- Team invite table and UI
- Resend-powered team invite emails

## Supabase SQL Updates

For a fresh database, run `supabase/schema.sql`.

For an existing database that already has the foundation tables, run:

```text
supabase/invite-flow.sql
```
- Light, minimal SaaS dashboard layout
