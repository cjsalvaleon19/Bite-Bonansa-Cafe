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

### `next` 14.2.10 → 15.5.15 (security upgrade)

**Upgrade path:** 14.2.10 → 14.2.35 → **15.5.15** (final)

**Reason:** Next.js 14.2.10 contained several critical CVEs, and the Server Components
DoS advisories (GHSA-q4gf-8mx6-v5v3, GHSA-h25m-26qc-wcjf) affect every Next.js version
from 13.0.0 up to 15.5.15 — the only fully patched release.

CVEs fixed by upgrading to 15.5.15:

| Advisory | Description |
|---|---|
| GHSA-7gfc-8cq8-jh5f | Authorization bypass |
| GHSA-g5qg-72qw-gw5v | Cache-key confusion for image optimization |
| GHSA-4342-x723-ch2f | Middleware SSRF redirect handling |
| GHSA-qpjv-v59x-3qc4 | Race condition to cache poisoning |
| GHSA-xv57-4mr9-wg8v | Content injection via image optimization |
| GHSA-f82v-jwr5-mffw | Authorization bypass in middleware |
| GHSA-q4gf-8mx6-v5v3 / GHSA-h25m-26qc-wcjf | Denial of Service with Server Components |
| GHSA-9g9p-9gw9-jx7f / GHSA-3x4c-7xq6-9pq8 | `next/image` DoS / disk-cache issues |
| GHSA-ggv3-7p47-pfv8 | HTTP request smuggling in rewrites |

**`npm audit` result after upgrade: 0 vulnerabilities.**

**Breaking changes (14.x → 15.x, Pages Router):** None for this codebase.
The Pages Router API (`useRouter`, `getStaticProps`, `getServerSideProps`,
custom `_app.js` / `_document.js`) is unchanged in Next.js 15. The breaking changes
introduced in Next.js 15 (async `params`/`searchParams`, async `cookies()`/`headers()`)
only affect the App Router, which this project does not use.

> **Future migration note:** If you later migrate to the App Router, update any
> page components that read `params` or `searchParams` to `await` those values, and
> update any Server Components that call `cookies()` or `headers()` to `await` them.
> See the [Next.js 15 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-15)
> for the full checklist.

### `@supabase/supabase-js` 2.45.0 → 2.103.2 (security patch)

**Reason:** Versions 2.41.1 – 2.49.2 bundle `@supabase/auth-js < 2.69.1`, which is
vulnerable to insecure path routing from malformed user input (GHSA-8r88-6cj9-9fh5).
Version 2.103.2 bundles a patched `@supabase/auth-js` and is the version recommended
by `npm audit`.

**Breaking changes:** None. The API surface used by this project
(`supabase.auth.signInWithPassword`, `getSession`, `onAuthStateChange`, `signOut`,
and the table query builder) is stable across the 2.x line and unchanged in 2.103.2.

### Other code improvements (previous sessions)

The following improvements were applied in earlier pull requests and are present in the
current codebase:

- **Service Worker** (`public/service-worker.js`): Implements network-first for HTML
  navigation, cache-first for static assets, and stale-while-revalidate for everything
  else. Falls back to `/offline` to prevent the browser "Content unavailable. Resource
  was not cached" error. Cache bumped to `bite-bonansa-v4`.
- **Zustand v5**: `store/useCartStore.js` uses the v5 named export
  (`import { create } from 'zustand'`), replacing the deprecated default import.
- **Dialog accessibility**: All Radix UI `<Dialog.Content>` elements include a
  `<Dialog.Title>` and `<Dialog.Description>` to satisfy screen-reader requirements.
- **Async navigation**: All `router.push()` / `router.replace()` calls are wrapped with
  `.catch(console.error)` to prevent unhandled promise rejections. The `dashboard.js`
  `onAuthStateChange` subscription is cleaned up on component unmount via the returned
  `subscription.unsubscribe()` callback.

## GitHub Projects — 10-Repository Connection Limit

GitHub enforces a hard limit of **10 repository connections per Project** (and
equivalently, a single repository cannot be linked to more than 10 Projects at
the same time). If you see the error:

> *A Git Repository cannot be connected to more than 10 Projects.*

it means this repository is already linked to 10 GitHub Projects and no new
connections can be added until at least one existing connection is removed.

### Identify connected projects

1. Go to the repository page on GitHub.
2. Click the **Projects** tab (next to Issues and Pull Requests in the top nav).
3. All projects this repository is currently linked to are listed there.

Alternatively, use the GitHub CLI:
```bash
gh project list --owner cjsalvaleon19
```

### Remove a project connection

**Via the GitHub UI (recommended):**

1. Open the Project board you want to unlink
   (e.g. `github.com/users/cjsalvaleon19/projects/<N>`).
2. Click the **⚙ Settings** icon (top-right of the project board).
3. Scroll to the **Repositories** (or *Linked repositories*) section.
4. Find `cjsalvaleon19/Bite-Bonansa-Cafe` in the list and click **Remove** (🗑 icon).
5. Confirm the removal — the project board itself is not deleted, only the
   repository link is removed.

**Via the GitHub CLI:**
```bash
# List linked repos for a project (replace <PROJECT_NUMBER> with the number
# shown in the project URL, e.g. 1 for .../projects/1)
gh api graphql -f query='
  query($login: String!, $number: Int!) {
    user(login: $login) {
      projectV2(number: $number) { title repositories(first: 20) { nodes { nameWithOwner } } }
    }
  }
' -f login=cjsalvaleon19 -F number=<PROJECT_NUMBER>

# Remove this repository from a ProjectV2 (requires its node ID):
# 1. Get the project node ID
gh api graphql -f query='{ user(login:"cjsalvaleon19") { projectV2(number:<PROJECT_NUMBER>) { id } } }'
# 2. Get this repo's node ID
gh api repos/cjsalvaleon19/Bite-Bonansa-Cafe --jq '.node_id'
# 3. Unlink
gh api graphql -f query='
  mutation($projectId: ID!, $repoId: ID!) {
    unlinkProjectV2FromRepository(input: { projectId: $projectId, repositoryId: $repoId }) { repository { nameWithOwner } }
  }
' -f projectId=<PROJECT_NODE_ID> -f repoId=<REPO_NODE_ID>
```

### Options for working within the 10-project limit

| Option | How |
|---|---|
| **Archive old projects** | Open the project → Settings → scroll to *Danger zone* → **Archive**. Archived projects are hidden but not deleted; you can restore them later. The repository slot is freed immediately. |
| **Delete unused projects** | Open the project → Settings → *Danger zone* → **Delete**. This is permanent. |
| **Unlink without deleting** | Follow the *Remove a project connection* steps above. The project board is kept intact; only the repository link is removed. |
| **Request a limit increase** | GitHub does not currently offer self-serve limit increases. You can contact [GitHub Support](https://support.github.com/contact) and request an exception, but approval is not guaranteed. |
| **Consolidate projects** | Merge related project boards into a single board using labels, custom fields, or milestones instead of separate boards. |

> **Tip:** Use GitHub's **Views** feature inside a single project to create
> multiple filtered/grouped perspectives without needing separate project boards.

## Contributing

Contributions are welcome! Please open issues or submit pull requests for enhancements or bug fixes.

## License
This project is licensed under the MIT License.