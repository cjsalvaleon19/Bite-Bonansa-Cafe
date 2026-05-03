# Delivery Reports Table Reference

## Table Schema

The `delivery_reports` table is created in **Migration 050** and has the following columns:

### Primary Columns
```sql
CREATE TABLE delivery_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Report details
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_deliveries INT NOT NULL DEFAULT 0,
  delivery_ids UUID[], -- Array of delivery IDs included in this report
  
  -- Financial details
  total_delivery_fees DECIMAL(10,2) NOT NULL DEFAULT 0, -- Total delivery fees collected
  rider_earnings DECIMAL(10,2) NOT NULL DEFAULT 0,      -- 60% commission for rider ✓
  business_revenue DECIMAL(10,2) NOT NULL DEFAULT 0,    -- 40% revenue for business
  
  -- Status and payment
  status VARCHAR(50) NOT NULL DEFAULT 'submitted',      -- 'submitted', 'paid', 'cancelled'
  submitted_at TIMESTAMP DEFAULT NOW(),
  paid_at TIMESTAMP,
  paid_by UUID REFERENCES users(id),                    -- Cashier who processed payment
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraint: One report per rider per day
  UNIQUE(rider_id, report_date)
);
```

## Common Column Name Confusion

### ❌ WRONG: `total_earnings`
This column **does NOT exist** in the `delivery_reports` table.

### ✅ CORRECT: `rider_earnings`
This is the actual column name for the rider's earnings (60% of total_delivery_fees).

## Correct Query Examples

### Query Reports
```sql
-- ✅ Correct: Use rider_earnings
SELECT id, report_date, rider_id, status, rider_earnings
FROM delivery_reports 
WHERE status = 'submitted'
ORDER BY created_at DESC;

-- ❌ Wrong: Using total_earnings will cause error
SELECT id, report_date, rider_id, status, total_earnings  -- ERROR!
FROM delivery_reports;
```

### Calculate Total Rider Earnings
```sql
-- ✅ Correct: Sum rider_earnings, not total_earnings
SELECT 
  rider_id,
  SUM(rider_earnings) as total_rider_earnings,
  SUM(total_delivery_fees) as total_fees_collected,
  COUNT(*) as report_count
FROM delivery_reports
WHERE status = 'paid'
GROUP BY rider_id;
```

### Update Report Status
```sql
-- ✅ Correct: Use actual UUID values
UPDATE delivery_reports
SET status = 'paid', paid_at = NOW()
WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';  -- Real UUID

-- ❌ Wrong: Placeholder text will cause UUID syntax error
UPDATE delivery_reports
SET status = 'paid', paid_at = NOW()
WHERE id = '<report-uuid>';  -- ERROR: invalid input syntax for type uuid
```

## Related Tables

### Riders Table
The `riders` table has a `total_earnings` column that tracks cumulative earnings:
```sql
-- riders table structure
CREATE TABLE riders (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  total_earnings DECIMAL(10,2) DEFAULT 0,  -- Cumulative total ✓
  deliveries_completed INT DEFAULT 0,
  ...
);
```

### Key Difference
- **`riders.total_earnings`**: Cumulative total of all-time earnings (updated when reports are paid)
- **`delivery_reports.rider_earnings`**: Earnings for a specific report/date (60% of delivery fees)

## Common Errors

### Error 1: Column Does Not Exist
```
ERROR: 42703: column "total_earnings" does not exist
LINE 1: SELECT id, report_date, rider_id, status, total_earnings
```
**Solution:** Use `rider_earnings` instead of `total_earnings`

### Error 2: Invalid UUID Syntax
```
ERROR: 22P02: invalid input syntax for type uuid: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```
**Solution:** Use an actual UUID from your database, not placeholder text

## Getting Actual UUIDs for Testing

Always retrieve real UUIDs before running UPDATE or WHERE queries:

```sql
-- Step 1: Get real UUIDs
SELECT id, report_date, rider_id, status, rider_earnings
FROM delivery_reports
ORDER BY created_at DESC
LIMIT 5;

-- Step 2: Copy a real UUID (e.g., a1b2c3d4-e5f6-7890-abcd-ef1234567890)
-- Step 3: Use it in your query
UPDATE delivery_reports
SET status = 'paid', paid_at = NOW()
WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';  -- ← Paste real UUID here
```

## Migration History
- **Migration 050**: Created `delivery_reports` table with `rider_earnings` column
- **Migration 071**: Fixed UUID casting in notification triggers
- No migration has ever added or renamed a `total_earnings` column to delivery_reports

## Additional Resources
- See `supabase/migrations/050_create_rider_portal_tables.sql` for full table definition
- See `DELIVERY_REPORT_SUBMISSION_FIX.md` for testing the payment flow
- See `riders` table for cumulative `total_earnings` tracking
