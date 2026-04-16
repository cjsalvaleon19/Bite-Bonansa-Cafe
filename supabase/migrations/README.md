# Supabase Database Migrations

This directory contains SQL migration scripts for the Bite Bonansa Cafe database schema.

## How to Apply Migrations

### Option 1: Using Supabase CLI
```bash
supabase db push
```

### Option 2: Manual Application via Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of each migration file in order
4. Execute the SQL

## Migration Files

- `002_add_shipping_payment_fields.sql` - Adds shipping address and payment method fields to users table for online ordering support

## Schema Overview

### Users Table
The users table includes the following fields for customer management:

**Basic Information:**
- `id` - User UUID (primary key, from Supabase Auth)
- `email` - User email address
- `full_name` - Customer full name
- `phone` - Contact phone number
- `address` - Billing address
- `role` - User role (customer, cashier, rider, admin)

**Loyalty Program:**
- `customer_id` - Unique customer ID (BBC-XXXXX format)
- `loyalty_balance` - Loyalty points balance

**Shipping & Delivery:**
- `shipping_address` - Delivery address for online orders
- `city` - City for shipping
- `postal_code` - Postal/ZIP code

**Payment:**
- `payment_method` - Preferred payment method (cash_on_delivery, gcash, paymaya, bank_transfer, credit_card)

## Notes

- All migrations should be applied in numerical order
- Always test migrations on a development database first
- Keep migration files immutable - create new ones for schema changes
