# Order Placement Error: Quick Troubleshooting

## Error Message

```
Failed to place order: Error: insert or update on table "orders" 
violates foreign key constraint "orders_customer_id_fkey"
```

## Quick Fix (2 Minutes)

### 1. Run SQL Migration

Copy and paste this SQL into Supabase SQL Editor and run it:

```sql
-- Drop existing foreign key constraint
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_customer_id_fkey;

-- Make customer_id nullable
ALTER TABLE public.orders
  ALTER COLUMN customer_id DROP NOT NULL;

-- Re-add foreign key constraint (allows NULL)
ALTER TABLE public.orders
  ADD CONSTRAINT orders_customer_id_fkey 
  FOREIGN KEY (customer_id) 
  REFERENCES public.users(id) 
  ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_orders_customer_id 
  ON public.orders(customer_id);
```

### 2. Reload Schema Cache ⚠️ CRITICAL

1. Go to **Project Settings** → **API**
2. Click **Reload schema** button
3. Wait for confirmation

**This step is mandatory! If you skip it, the error will persist.**

### 3. Test

Try placing an order again. It should work now!

---

## Still Getting Errors?

### Error: "Could not find the 'customer_id' column in the schema cache"

**Solution:** You forgot to reload the schema cache. Go to Project Settings → API → Reload schema.

### Error: "permission denied for table orders"

**Solution:** Run this in SQL Editor:

```sql
GRANT ALL ON public.orders TO authenticated;
GRANT ALL ON public.orders TO anon;
```

Then reload schema cache.

### Error: "null value in column 'items' violates not-null constraint"

**Solution:** Different issue. The cart is empty. Make sure items are added to cart before placing order.

### Error: "relation 'public.users' does not exist"

**Solution:** You need to create the users table first:

```sql
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  loyalty_balance DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

Then reload schema cache and retry the customer_id fix.

---

## Prevention

To prevent this error in the future:

1. **Always reload schema cache** after running SQL migrations
2. **Test in development** before deploying to production
3. **Create user records** in public.users when users sign up (optional)

---

## More Help

For detailed information, see:
- **FIX_CUSTOMER_ID_CONSTRAINT.md** - Complete guide
- **ORDER_PLACEMENT_FIX_SUMMARY.md** - Overview and technical details
- **fix_customer_id_nullable.sql** - Full SQL migration script

---

## Emergency Rollback

If something goes wrong, you can rollback with:

```sql
-- Drop the constraint
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_customer_id_fkey;

-- Make customer_id NOT NULL again
ALTER TABLE public.orders
  ALTER COLUMN customer_id SET NOT NULL;

-- Re-add original constraint
ALTER TABLE public.orders
  ADD CONSTRAINT orders_customer_id_fkey 
  FOREIGN KEY (customer_id) 
  REFERENCES public.users(id) 
  ON DELETE CASCADE;
```

**Note:** This only works if all existing orders have valid customer_id values.

---

**Last Updated:** 2026-04-27  
**Status:** ✅ Production Ready
