# Order Number Duplicate Key Error - Complete Solution

## 📋 Quick Summary

**Error:** `duplicate key value violates unique constraint "orders_order_number_key"`

**Cause:** Global UNIQUE constraint on `order_number` column prevents daily resets

**Fix:** Replace global constraint with composite index (order_number + date)

**Time to Fix:** 2 minutes

**Downtime:** None

---

## 🚀 Quick Fix (3 Steps)

### Step 1: Diagnose
Run this in **Supabase SQL Editor**:
```bash
# Use the diagnostic script
/diagnose_order_number_constraint.sql
```
Or open: `diagnose_order_number_constraint.sql` and run it in Supabase.

### Step 2: Apply Fix
Open `IMMEDIATE_FIX_DUPLICATE_ORDER_NUMBER.md` and follow the instructions.

The fix will:
- ✅ Remove the global UNIQUE constraint
- ✅ Create a composite unique index (order_number, date)
- ✅ Allow daily order number resets
- ✅ Prevent duplicates within same day

### Step 3: Verify
Run verification queries from the fix guide to confirm it worked.

---

## 📁 Files to Use

1. **`diagnose_order_number_constraint.sql`**
   - Run this FIRST to check current state
   - Shows exactly what's wrong
   - Takes 5 seconds

2. **`IMMEDIATE_FIX_DUPLICATE_ORDER_NUMBER.md`**
   - Complete step-by-step fix guide
   - Copy/paste SQL script
   - Includes verification steps

3. **`supabase/migrations/046_fix_duplicate_order_number_constraint.sql`**
   - The actual migration file
   - Can be run directly via Supabase CLI
   - Or copy SQL from this file

---

## 🔍 Understanding the Problem

### Current State (Broken)
```
orders table
├── order_number VARCHAR(3)
└── UNIQUE constraint: orders_order_number_key
    └── ❌ Prevents same order_number from existing twice
        └── Problem: Order 001 created yesterday
        └── Problem: Order 001 created today → DUPLICATE KEY ERROR
```

### Fixed State
```
orders table
├── order_number VARCHAR(3)
├── created_at TIMESTAMP
└── UNIQUE INDEX: idx_orders_order_number_date_unique
    └── ON (order_number, created_at::date)
    └── ✅ Prevents same order_number on same day
        └── Solution: Order 001 created yesterday (2024-04-29)
        └── Solution: Order 001 created today (2024-04-30) → SUCCESS!
```

---

## 🎯 Why This Happened

Your order numbering system is designed to:
1. Start at 001 each day
2. Increment throughout the day (001, 002, 003...)
3. Reset to 001 the next day

But the database has a global UNIQUE constraint that says:
- "order_number must be unique across ALL time"

This conflicts with the daily reset design!

**Migration 046 exists** in your repository to fix this, but it **hasn't been applied** to your production database yet.

---

## 💡 How the Fix Works

### The SQL Fix (Simplified)

```sql
-- 1. Remove the problematic constraint
ALTER TABLE orders DROP CONSTRAINT orders_order_number_key;

-- 2. Add composite index for per-day uniqueness
CREATE UNIQUE INDEX idx_orders_order_number_date_unique
ON orders (order_number, (created_at::date));
```

This allows:
- ✅ Order 001 on 2024-04-29
- ✅ Order 001 on 2024-04-30 (different date = allowed)
- ❌ Two orders with number 001 on 2024-04-30 (same date = prevented)

---

## ✅ Testing After Fix

### Test 1: Order Placement
```
1. Go to customer order page
2. Add items to cart
3. Click "Place Order"
4. Expected: Order created successfully ✅
5. Check: No "duplicate key" error in console ✅
```

### Test 2: Daily Reset
```
1. Note highest order number today (e.g., 015)
2. Wait until tomorrow
3. Place a new order
4. Expected: Order number starts at 001 ✅
5. Check: No errors ✅
```

### Test 3: Database State
```sql
-- Should return NO ROWS (constraint is gone)
SELECT constraint_name 
FROM information_schema.table_constraints
WHERE table_name = 'orders' 
  AND constraint_name = 'orders_order_number_key';

-- Should return 1 ROW (index exists)
SELECT indexname 
FROM pg_indexes 
WHERE indexname = 'idx_orders_order_number_date_unique';
```

---

## 🔧 Alternative: Use Supabase CLI

If you prefer to use the command line:

```bash
# Navigate to project
cd /home/runner/work/Bite-Bonansa-Cafe/Bite-Bonansa-Cafe

# Apply migration 046
supabase db push

# Or apply specific migration
psql -h your-db-host -U postgres -d postgres \
  -f supabase/migrations/046_fix_duplicate_order_number_constraint.sql
```

---

## 📚 Related Documentation

- **`URGENT_FIX_DUPLICATE_ORDER_NUMBER_ERROR.md`** - Original detailed fix guide
- **`APPLY_MIGRATIONS_045_046_NOW.md`** - Instructions for migrations 045, 046, 047
- **`FIX_MIGRATION_046_IMMUTABLE_ERROR.md`** - Technical details about IMMUTABLE vs STABLE
- **`FIX_EOD_REPORT_AND_ORDER_ERRORS.md`** - Related fixes for EOD report

---

## 🆘 Troubleshooting

### Error still occurs after fix
1. **Check if fix was applied:**
   ```sql
   SELECT * FROM pg_constraint WHERE conname = 'orders_order_number_key';
   -- Should return NO ROWS
   ```

2. **Clear application cache:**
   - Redeploy your application
   - Or restart your Next.js server
   - Hard refresh browser (Ctrl+Shift+R)

3. **Check for other constraints:**
   ```sql
   -- List ALL unique constraints
   SELECT conname, contype 
   FROM pg_constraint c
   JOIN pg_class t ON c.conrelid = t.oid
   WHERE t.relname = 'orders' AND c.contype = 'u';
   ```

### Fix script fails
1. **Permission issues:** Ensure you're running as database owner or superuser
2. **Concurrent access:** Ensure no active transactions on orders table
3. **Retry:** Some operations may timeout - try running again

### Still need help
1. Run `diagnose_order_number_constraint.sql` and share results
2. Check browser console for exact error message
3. Check Supabase logs for database errors
4. Share the output of verification queries

---

## 📊 Migration History

This fix is part of a series of order number improvements:

- **Migration 017:** Added 4-digit daily order numbers
- **Migration 035:** Updated to 3-digit daily order numbers
- **Migration 039:** Removed legacy generate_order_number function
- **Migration 040:** Fixed order numbers to start at 001 (not 000)
- **Migration 046:** Fixed duplicate key constraint (THIS FIX)

---

## 🎓 Key Learnings

1. **Daily resets need composite indexes, not global constraints**
2. **Use `created_at::date` (IMMUTABLE) not `DATE()` (STABLE) in indexes**
3. **Migration files in repo ≠ migrations applied to database**
4. **Always test migrations in staging before production**

---

## 📝 Next Steps

After fixing this issue:

1. ✅ Apply the fix (2 minutes)
2. ✅ Test order placement
3. ✅ Monitor for 24 hours
4. ✅ Test daily reset next day
5. 📋 Document that migration 046 was applied
6. 🔄 Consider automatic migration deployment

---

**Status:** Ready to apply

**Priority:** 🚨 CRITICAL

**Impact:** High - Blocks all order creation

**Difficulty:** Easy - Copy/paste SQL fix

---

## Quick Links

- [Immediate Fix Guide](./IMMEDIATE_FIX_DUPLICATE_ORDER_NUMBER.md)
- [Diagnostic Script](./diagnose_order_number_constraint.sql)
- [Migration File](./supabase/migrations/046_fix_duplicate_order_number_constraint.sql)
