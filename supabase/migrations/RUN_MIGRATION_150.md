# Migration 150: When 149 is already applied but 500 still occurs

---

## 🚫 DO NOT paste text from THIS file into the SQL Editor

**This is a documentation file (`.md`). SQL code shown here is wrapped in**
**markdown code fences (` ``` `). If you paste from this file you will get:**

```
ERROR: 42601: syntax error at or near "```"
```

**To apply this migration, open and copy from the actual SQL file:**

```
supabase/migrations/150_force_cleanup_purchase_tracking_triggers.sql
```

Open it in **VS Code, Notepad, or any plain text editor** → Select All → Copy → paste into Supabase SQL Editor.

---

Use this only if:
- You already applied `149_jsonb_extract_path_text_purchase_tracking.sql`, **and**
- Completing orders still returns HTTP 500 with:
  `ON CONFLICT DO UPDATE command cannot affect row a second time`

## Why this happens

In some environments, an additional legacy trigger (with a non-standard name)
remains attached to `public.orders` and still executes old purchase-tracking
logic. Migration 149 removes known trigger/function names, but this case can
survive if an unexpected trigger/function name exists.

Migration 150 force-cleans all purchase-tracking-related triggers on
`public.orders` and recreates only the safe trigger/function.

---

## Apply

Run:

`supabase/migrations/150_force_cleanup_purchase_tracking_triggers.sql`

in the Supabase SQL Editor.

Expected output includes:

`NOTICE: Migration 150 applied: purchase-tracking triggers force-cleaned and safe trigger recreated.`

---

## Verify

### 1) List all non-internal triggers currently on orders

```sql
SELECT
  t.tgname AS trigger_name,
  p.proname AS function_name,
  pn.nspname AS function_schema
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
JOIN pg_namespace pn ON pn.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND c.relname = 'orders'
  AND NOT t.tgisinternal
ORDER BY t.tgname;
```

### 2) Confirm purchase tracking is bound only to `track_customer_item_purchases`

```sql
SELECT
  t.tgname,
  p.proname
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE n.nspname = 'public'
  AND c.relname = 'orders'
  AND NOT t.tgisinternal
  AND (
    p.proname ILIKE '%purchase%'
    OR p.proname ILIKE '%customer%purchase%'
  );
```

Expected: only `trg_track_customer_purchases -> track_customer_item_purchases`.

### 3) Confirm function body is the safe one

```sql
SELECT pg_get_functiondef('public.track_customer_item_purchases'::regproc);
```

Look for:
- `jsonb_extract_path_text(item, 'id')`
- `FOR v_item IN`
- inner + outer `EXCEPTION WHEN OTHERS`

---

## Note on browser console message

`A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received`

This usually comes from a browser extension message channel and is not the root
cause of this server-side 500.
