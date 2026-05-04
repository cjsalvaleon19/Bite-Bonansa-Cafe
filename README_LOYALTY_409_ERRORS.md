# 409 Loyalty Duplicate Key Error - Complete Guide

## Quick Summary

You're seeing 409 errors in the browser console related to loyalty points:
```
Failed to load resource: the server responded with a status of 409
duplicate key value violates unique constraint "unique_loyalty_per_order"
```

**This document explains what's happening and how to handle it.**

---

## Step 1: Verify Migration Status

**→ Follow instructions in:** `VERIFY_LOYALTY_MIGRATIONS.md`

Run the SQL queries in your Supabase dashboard to check if migration 082 has been applied.

---

## Step 2: Understand the Error

**→ Read:** `LOYALTY_409_ERROR_EXPLANATION.md`

This explains:
- Why 409 errors appear
- Whether they're harmful (spoiler: they're not)
- How the frontend handles them
- What users experience

---

## Step 3: Apply Fix (If Needed)

**→ Follow instructions in:** `URGENT_FIX_409_LOYALTY_ERRORS.md`

If verification shows migration 082 hasn't been applied:
1. Go to Supabase SQL Editor
2. Copy contents of `supabase/migrations/082_fix_loyalty_duplicate_error.sql`
3. Run it
4. Verify it worked

---

## Quick Decision Tree

```
┌─ Are you seeing 409 errors in console?
│
├─ YES → Run verification queries (VERIFY_LOYALTY_MIGRATIONS.md)
│   │
│   ├─ Migration IS applied (all checks pass)
│   │   └─ Read LOYALTY_409_ERROR_EXPLANATION.md
│   │      └─ Errors are expected/harmless → No action needed ✓
│   │
│   └─ Migration NOT applied (checks fail)
│       └─ Follow URGENT_FIX_409_LOYALTY_ERRORS.md
│          └─ Apply migration 082 immediately
│
└─ NO → Everything working normally ✓
```

---

## Files in This Package

| File | Purpose |
|------|---------|
| `README_LOYALTY_409_ERRORS.md` | This file - overview and navigation |
| `VERIFY_LOYALTY_MIGRATIONS.md` | SQL queries to check migration status |
| `LOYALTY_409_ERROR_EXPLANATION.md` | Technical explanation of the errors |
| `URGENT_FIX_409_LOYALTY_ERRORS.md` | How to apply the database fix |
| `supabase/migrations/082_fix_loyalty_duplicate_error.sql` | The migration file |

---

## TL;DR

### If Migration IS Applied
- 409 errors are **expected behavior**
- Frontend handles them **gracefully**
- Users see **no problems**
- Loyalty points work **correctly** (no duplicates)
- **No action needed**

### If Migration NOT Applied  
- Apply migration 082 **immediately**
- Follow instructions in `URGENT_FIX_409_LOYALTY_ERRORS.md`
- This fixes the root cause in database

---

## Related Code Files

- `pages/cashier/orders-queue.js` - Frontend error handling
- `supabase/migrations/079_ensure_loyalty_conflict_handling.sql` - Earlier migration
- `supabase/migrations/082_fix_loyalty_duplicate_error.sql` - Main fix
- `supabase/migrations/RUN_MIGRATION_082.md` - Migration documentation

---

## Questions?

1. **Q: Are customers losing loyalty points?**
   A: No. The duplicate prevention ensures points are awarded exactly once.

2. **Q: Is the Orders Queue broken?**
   A: No. Frontend handles the 409s gracefully. Orders complete normally.

3. **Q: Should I be worried about the console errors?**
   A: Only if migration 082 hasn't been applied. Otherwise, they're harmless.

4. **Q: Can I hide the console warnings?**
   A: Yes, but not recommended. They help with debugging. See LOYALTY_409_ERROR_EXPLANATION.md.

5. **Q: Will this affect customers?**
   A: No. This is backend behavior only. Customers never see these errors.

---

## Support

If you need help:
1. First, run the verification queries
2. Check which files are relevant to your situation
3. Follow the appropriate guide
4. If still stuck, share the verification query results when asking for help

---

**Last Updated:** May 4, 2026
**Related Migrations:** 074, 079, 082
**Affected Systems:** Orders Queue, Loyalty Points
