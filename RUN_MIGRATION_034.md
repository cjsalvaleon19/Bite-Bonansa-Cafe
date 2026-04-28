# RUN MIGRATION 034 - Add Items Column to Orders

## Quick Reference Guide

### What This Migration Does
Adds the missing `items` JSONB column to the `orders` table to fix checkout errors.

---

## ⚡ Quick Start (Copy & Paste)

### Option 1: Supabase Dashboard (Easiest)

1. Open Supabase Dashboard → SQL Editor
2. Copy and paste this SQL:

```sql
-- Add items column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'items'
  ) THEN
    ALTER TABLE orders ADD COLUMN items JSONB;
    COMMENT ON COLUMN orders.items IS 'Array of order items: {id, name, price, quantity}';
    CREATE INDEX IF NOT EXISTS idx_orders_items_gin ON orders USING GIN (items);
    RAISE NOTICE 'Added items column to orders table';
  ELSE
    RAISE NOTICE 'items column already exists in orders table';
  END IF;
END $$;

-- Verify
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'orders' AND column_name = 'items';
```

3. Click **Run**
4. Look for: ✅ "Added items column to orders table"

---

### Option 2: Supabase CLI

```bash
# Navigate to project directory
cd /path/to/Bite-Bonansa-Cafe

# Apply migration
supabase db push

# Or run specific migration
supabase migration up
```

---

### Option 3: psql Command Line

```bash
psql "YOUR_DATABASE_CONNECTION_STRING" \
  -f supabase/migrations/034_add_items_column_to_orders.sql
```

---

## ✅ Verification

After running, verify the column exists:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'orders' AND column_name = 'items';
```

**Expected Output:**
```
 column_name | data_type | is_nullable 
-------------+-----------+-------------
 items       | jsonb     | YES
```

---

## 🧪 Test the Fix

1. Navigate to `/cashier/pos` in your app
2. Add items to cart
3. Fill in customer details
4. Click **Checkout**
5. ✅ Order should complete without errors

---

## 📊 What Gets Stored

The `items` column stores JSONB like this:

```json
[
  {
    "id": "item-uuid-1",
    "name": "Chicken Burger (Honey Butter)",
    "price": 120,
    "quantity": 2
  },
  {
    "id": "item-uuid-2",
    "name": "Fries (Cheese)",
    "price": 60,
    "quantity": 1
  }
]
```

---

## ⚠️ Important Notes

- ✅ **Safe to run multiple times** (idempotent)
- ✅ **No data loss** - existing orders keep their data
- ✅ **Backward compatible** - old orders have `items = NULL`
- ✅ **No downtime** - can run on live database
- ✅ **Automatic index creation** - optimized for performance

---

## 🆘 Troubleshooting

### Error: "permission denied for table orders"
**Solution:** Make sure you're connected as a user with ALTER TABLE permissions

### Error: "relation 'orders' does not exist"
**Solution:** The orders table needs to be created first. Check `database_schema.sql`

### Column already exists but checkout still fails
**Solution:** 
1. Check Supabase cache refresh (wait 2-3 minutes)
2. Restart your application
3. Verify column type is `jsonb` not `json`

### GIN index creation fails
**Solution:** Index is optional for functionality. The column will still work.

---

## 📚 Additional Documentation

- **Complete Guide:** `FIX_CHECKOUT_ERROR_ITEMS_COLUMN.md`
- **Summary:** `CHECKOUT_ERROR_FIX_SUMMARY.md`
- **Test Queries:** `test_migration_034.sql`
- **Migration File:** `supabase/migrations/034_add_items_column_to_orders.sql`

---

## 🎯 Success Checklist

After running the migration:

- [ ] Column exists: `SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'items';`
- [ ] Index created: `SELECT indexname FROM pg_indexes WHERE tablename = 'orders' AND indexname = 'idx_orders_items_gin';`
- [ ] POS checkout works: Test placing an order
- [ ] No errors in console: Check browser developer tools
- [ ] Order created: `SELECT id, items FROM orders ORDER BY created_at DESC LIMIT 1;`

---

**Migration:** 034  
**Status:** Ready to apply  
**Risk Level:** Low (additive change only)  
**Rollback:** Not needed (but possible if required)
