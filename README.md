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

## Contributing
Contributions are welcome! Please open issues or submit pull requests for enhancements or bug fixes.

## License
This project is licensed under the MIT License.