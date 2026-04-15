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

### Local Development

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env.local
# Edit .env.local and fill in your real Supabase credentials

# 3. Run the development server
npm run dev
```

### Required Environment Variables

| Variable | Description | Where to find it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Supabase Dashboard → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anonymous key | Supabase Dashboard → Project Settings → API → anon / public |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** server-side key | Supabase Dashboard → Project Settings → API → service_role |

> ⚠️ Never commit `SUPABASE_SERVICE_ROLE_KEY` to source control. It should only be set in your local `.env.local` (which is git-ignored) and in Vercel's Environment Variables.

### Vercel Deployment

1. Import the repository into [Vercel](https://vercel.com).
2. In the Vercel project, go to **Settings → Environment Variables** and add all three variables above.
3. Redeploy to apply the changes.

To verify your configuration, visit `https://<your-deployment>/api/health` after deploying.


## Contributing
Contributions are welcome! Please open issues or submit pull requests for enhancements or bug fixes.

## License
This project is licensed under the MIT License.