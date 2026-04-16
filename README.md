# Bite Bonansa Cafe Online Ordering System

## Overview
Bite Bonansa Cafe is a comprehensive online ordering system designed to streamline cafe operations, enhance customer experience, and improve business efficiency. This README outlines the major features of the system.

## Features

### 1. Cashier Management
- **Sales Processing**: Handle customer transactions efficiently.
- **Refund Processing**: Manage refunds and returns seamlessly.
- **Sales Reports**: Generate daily, weekly, and monthly sales reports for analysis.

### 2. Customer Portal
- **User Registration/Login**: Secure account creation and access.
- **Menu Browsing**: Explore the cafe menu with detailed descriptions and images.
- **Order Placement**: Easily order food and drinks directly from the portal.
- **Order Tracking**: Track the status of current orders in real-time.

### 3. Rider Delivery
- **Delivery Scheduling**: Schedule deliveries based on customer preferences.
- **Rider Management**: Manage rider assignments and track delivery status.
- **Geolocation**: Utilize GPS to optimize delivery routes and times.

### 4. Inventory Management
- **Stock Monitoring**: Track inventory levels and manage stock efficiently.
- **Alerts**: Receive notifications for low inventory and restocking needs.
- **Supplier Management**: Easily manage supplier information and reorder supplies.

### 5. Accounting Reports
- **Financial Tracking**: Keep track of profits, losses, and other financial metrics.
- **Expense Management**: Document and review business expenses.
- **Comprehensive Reports**: Generate detailed accounting reports for auditing and analysis.

## Getting Started

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project

### 1. Clone and install dependencies
```bash
npm install
```

### 2. Set up environment variables

Copy `.env.example` to `.env.local` and fill in your real values:

```bash
cp .env.example .env.local
```

Edit `.env.local` with the following variables (all are required):

| Variable | Where to find it | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API | Must start with `https://` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API | Public key, safe for frontend |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API → service_role | **Keep secret** — server-side only |
| `NEXT_PUBLIC_API_URL` | Your app's base URL | `http://localhost:3000` for local dev |

> ⚠️ **Never commit your `.env.local` file or expose `SUPABASE_SERVICE_ROLE_KEY` on the client.**

### 3. Run the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Verify configuration

After starting the server, visit [http://localhost:3000/api/health](http://localhost:3000/api/health) to confirm all environment variables are correctly configured:

```json
{ "status": "ok", "checks": { ... } }
```

If any variable is missing or invalid, the response will show `"status": "misconfigured"` with details about which variables need attention.

## Deploying to Vercel

1. Import the repository into [Vercel](https://vercel.com).
2. Go to **Project Settings → Environment Variables** and add each variable from the table above.
   - Set `SUPABASE_SERVICE_ROLE_KEY` to **Production** and **Preview** environments only (it must stay server-side).
3. Redeploy the project after adding the variables.
4. Visit `https://<your-vercel-url>/api/health` to confirm the deployment is correctly configured.

### Troubleshooting registration (500 errors)

If `/api/register` returns a 500 error with `"Service unavailable. Please contact support."`:

1. Open the Vercel Dashboard → your project → **Functions** tab.
2. Click on `/api/register` and check the logs for lines like:
   - `[register] NEXT_PUBLIC_SUPABASE_URL is not set or invalid` → The URL env var is missing or has a placeholder value.
   - `[register] SUPABASE_SERVICE_ROLE_KEY is not set` → The service role key env var is missing.
3. Correct the missing variable in **Project Settings → Environment Variables** and **redeploy**.
4. Check `/api/health` after redeploying to confirm all checks pass.

## Environment Variables

This project requires the following environment variables to connect to Supabase. Copy `.env.example` to `.env.local` and fill in the values from your [Supabase project settings](https://app.supabase.com/project/_/settings/api).

| Variable | Where to find it | Used by |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API → Project URL | Frontend + API routes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API → anon / public key | Frontend pages |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API → service_role key | Server-side API routes only (`/api/register`, `/api/customers`) |

> **Security note:** `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security. Never expose it to the browser — only use it in server-side API routes.

### Deploying to Vercel

1. Go to your project on the [Vercel Dashboard](https://vercel.com/dashboard).
2. Navigate to **Settings → Environment Variables**.
3. Add all three variables above with their exact names and correct values.
4. Set the environment scope to **Production** (and **Preview** if needed).
5. **Redeploy** the project — Vercel does not pick up new env vars until the next deployment.

If `/api/register` or `/api/customers` returns HTTP 500 with the message *"Service unavailable. Please contact support."*, check the Vercel **Functions** logs for a line like:

```
[customers] NEXT_PUBLIC_SUPABASE_URL is not set or invalid
[customers] SUPABASE_SERVICE_ROLE_KEY is not set
[register] NEXT_PUBLIC_SUPABASE_URL is not set or invalid
[register] SUPABASE_SERVICE_ROLE_KEY is not set
```

This confirms which variable is missing or misconfigured.

## Dependency Upgrades & Migration Notes

### `next` 14.2.10 → 14.2.35 (security patch)

**Reason:** Next.js 14.2.10 contained several CVEs including an authorization bypass
(GHSA-7gfc-8cq8-jh5f), cache-key confusion for image optimization (GHSA-g5qg-72qw-gw5v),
and potential SSRF via middleware redirect handling (GHSA-4342-x723-ch2f).
Version 14.2.35 is the latest patched release in the 14.x line and fixes all of the
above.

**Breaking changes:** None — 14.2.35 is a patch release within the same minor line.

**Note on remaining advisories:** The `npm audit` report for 14.2.35 still lists a small
set of advisories that do **not** apply to this project:

| Advisory | Reason it does not apply |
|---|---|
| GHSA-q4gf-8mx6-v5v3 / GHSA-h25m-26qc-wcjf (Server Components DoS) | App uses Pages Router — no React Server Components or Server Actions |
| GHSA-9g9p-9gw9-jx7f / GHSA-3x4c-7xq6-9pq8 (`next/image` issues) | `next/image` is not used anywhere in the codebase |
| GHSA-ggv3-7p47-pfv8 (HTTP request smuggling in rewrites) | No `rewrites` are configured in `next.config.js` |

A full upgrade to Next.js 15.x+ would resolve all outstanding advisories but requires
migrating from Pages Router to App Router and updating several APIs — that migration is
outside the scope of this change.

### `@supabase/supabase-js` 2.45.0 → 2.103.2 (security patch)

**Reason:** Versions 2.41.1 – 2.49.2 bundle `@supabase/auth-js < 2.69.1`, which is
vulnerable to insecure path routing from malformed user input (GHSA-8r88-6cj9-9fh5).
Version 2.103.2 bundles a patched `@supabase/auth-js` and is the version recommended
by `npm audit`.

**Breaking changes:** None expected. The API surface used by this project
(`supabase.auth.signInWithPassword`, `getSession`, `onAuthStateChange`, `signOut`,
and the table query builder) is stable across the 2.x line and unchanged in 2.103.2.

### Other code improvements (previous sessions)

The following improvements were applied in earlier pull requests and are present in the
current codebase:

- **Service Worker** (`public/service-worker.js`): Implements network-first for HTML
  navigation, cache-first for static assets, and stale-while-revalidate for everything
  else. Falls back to `/offline` to prevent the browser "Content unavailable. Resource
  was not cached" error. Cache bumped to `bite-bonansa-v2`.
- **Zustand v5**: `store/useCartStore.js` uses the v5 named export
  (`import { create } from 'zustand'`), replacing the deprecated default import.
- **Dialog accessibility**: All Radix UI `<Dialog.Content>` elements include a
  `<Dialog.Title>` and `<Dialog.Description>` to satisfy screen-reader requirements.
- **Async navigation**: All `router.push()` / `router.replace()` calls are wrapped with
  `.catch(console.error)` to prevent unhandled promise rejections. The `dashboard.js`
  `onAuthStateChange` subscription is cleaned up on component unmount via the returned
  `subscription.unsubscribe()` callback.

## Contributing
Contributions are welcome! Please open issues or submit pull requests for enhancements or bug fixes.

## License
This project is licensed under the MIT License.