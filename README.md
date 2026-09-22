# Finance Balance Monitor

Full source code for the Finance Balance Monitor app: cash transactions, bank
accounts with overdraft limits, banking facilities (drawdowns, letters of
credit, amendments, maturities and settlements), upcoming payments and
receivables, transaction histories, Excel exports, a summary dashboard, Google
Workspace sign-in and per-account access control.

## Tech stack

- React 19 + TypeScript
- TanStack Start (SSR) + TanStack Router (file-based routes) + TanStack Query
- Vite 7/8 build, targeting an edge/Cloudflare Worker runtime
- Tailwind CSS v4 + shadcn/ui components
- Supabase (Postgres, auth, row level security)

## Getting started

```bash
bun install          # or: npm install
cp .env.example .env # fill in your Supabase values
bun run dev          # http://localhost:8080
```

Build and preview production:

```bash
bun run build
bun run preview
```

## Environment variables

See `.env.example`. `VITE_*` values are exposed to the browser (safe,
publishable). `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never be
shipped to the client — the API routes use it for tenant-scoped access.

## Database

SQL migrations live in `supabase/migrations/` (apply with the Supabase CLI:
`supabase db push`) and `drizzle/migrations/`. Generated table types are in
`src/integrations/supabase/types.ts`.

Main tables: `bank_accounts`, `cash_transactions`, `facilities`,
`facility_transactions`, `facility_lc_amendments`, `expected_transactions`,
`daily_snapshots`, `app_access`.

Row level security is enabled and tables are not exposed to the anon or
authenticated roles directly — all reads and writes go through the server API
routes, which verify the caller and apply tenant scoping.

## Project layout

```
src/
  routes/                 file-based pages
    index.tsx             summary dashboard
    cash.tsx              cash transaction entry
    expected.tsx          upcoming payments / receivables
    bank-accounts.tsx     bank accounts + overdraft limits
    facilities.tsx        facility management
    facility-transactions.tsx  drawdowns, LCs, amendments, settlement
    facility-history.tsx  facility transaction history
    facility-list.tsx     facility balances with active items
    transactions.tsx      cash transaction history
    access.tsx            admin-only access control
    api/data/*            server API endpoints
  components/             AppShell, SignIn, shadcn/ui
  lib/
    tenant.ts             domain lock, admin email, feature permissions
    app-auth.ts           server-side auth + permission guards
    session-context.tsx   client session, permissions, sign in/out
    qne-client.ts         fetch helper that attaches the auth token
    finance.ts            shared money helpers
    export-xlsx.ts        Excel export helper
  integrations/supabase/  generated clients and types
```

## Authentication and access control

- Sign-in is Google OAuth, locked to a single Workspace domain.
- The allowed domain, tenant code and administrator email are set in
  `src/lib/tenant.ts` — change them for your own deployment.
- The administrator account manages the `app_access` table: it can revoke an
  account entirely, or set each feature to Full, View only, or Off. These rules
  are enforced both in the UI and on every API route.

If you move off Lovable Cloud auth, replace `src/integrations/lovable/index.ts`
with a standard `supabase.auth.signInWithOAuth({ provider: 'google' })` call;
everything else (token verification in `src/lib/app-auth.ts`) keeps working
since it validates a normal Supabase access token.

## Deployment

The app builds to an edge/Worker-compatible server bundle (Cloudflare Workers
by default via nitro). Any Node or edge host that can run the Vite SSR output
works; set the environment variables listed above on the host.
