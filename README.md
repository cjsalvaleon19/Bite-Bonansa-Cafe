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
To set up your local environment, follow the installation instructions provided in the documentation.

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

## Contributing
Contributions are welcome! Please open issues or submit pull requests for enhancements or bug fixes.

## License
This project is licensed under the MIT License.