# Verify Loyalty Migrations Status

Run these SQL queries in your Supabase SQL Editor to check migration status:

## Query 1: Check Unique Constraint
```sql
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conname = 'unique_loyalty_per_order';
```

**Expected Result:**
- Should return 1 row
- constraint_name: `unique_loyalty_per_order`
- definition: `UNIQUE (order_id, transaction_type)`

**If no rows returned:** Migration 082 has NOT been applied. Apply it immediately.

## Query 2: Check Trigger Exists
```sql
SELECT 
  tgname as trigger_name,
  tgtype as trigger_type,
  tgenabled as enabled
FROM pg_trigger 
WHERE tgname = 'trg_award_loyalty_points_on_order_completion';
```

**Expected Result:**
- Should return 1 row  
- trigger_name: `trg_award_loyalty_points_on_order_completion`
- enabled: `O` (trigger is enabled)

**If no rows returned:** Trigger doesn't exist. Apply migration 082.

## Query 3: Check ON CONFLICT Handling
```sql
SELECT 
  proname as function_name,
  prosrc as source_code
FROM pg_proc 
WHERE proname = 'award_loyalty_points_on_order_completion';
```

**Expected Result:**
- Should return 1 row
- source_code should contain: `ON CONFLICT (order_id, transaction_type) DO NOTHING`

**If ON CONFLICT clause is missing:** Old version of trigger. Apply migration 082.

## Query 4: Check for Duplicate Loyalty Records
```sql
SELECT 
  order_id,
  transaction_type,
  COUNT(*) as duplicate_count
FROM loyalty_transactions
WHERE transaction_type = 'earned'
GROUP BY order_id, transaction_type
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;
```

**Expected Result:**
- Should return 0 rows (no duplicates)

**If rows are returned:** 
- You have duplicate loyalty awards in your database
- These happened before migration 082 was applied
- They don't affect current functionality but indicate past issues

## Query 5: Recent Loyalty Transactions
```sql
SELECT 
  lt.id,
  lt.order_id,
  o.order_number,
  lt.customer_id,
  lt.amount,
  lt.balance_after,
  lt.created_at
FROM loyalty_transactions lt
LEFT JOIN orders o ON o.id = lt.order_id  
WHERE lt.transaction_type = 'earned'
ORDER BY lt.created_at DESC
LIMIT 10;
```

**Purpose:** View recent loyalty awards to ensure they're working correctly

---

## What To Do Based on Results

### ✅ All Checks Pass
- Migration is applied correctly
- 409 errors are expected behavior (duplicate prevention working)
- No action needed
- See `LOYALTY_409_ERROR_EXPLANATION.md` for details

### ❌ Query 1 Returns No Rows
- **Action Required:** Apply migration 082 immediately
- See `URGENT_FIX_409_LOYALTY_ERRORS.md` for instructions

### ⚠️ Query 3 Shows No ON CONFLICT Clause  
- **Action Required:** Trigger function is outdated
- Apply migration 082 to update it

### ⚠️ Query 4 Shows Duplicates
- **Informational:** Past duplicates exist from before migration
- Current functionality is protected if Query 1-3 pass
- Optionally clean up old duplicates (ask for help if needed)
