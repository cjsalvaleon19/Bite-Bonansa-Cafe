# Migration 149: Permanent Fix — `jsonb_extract_path_text()` (URGENT)

## ⚠️ Apply This Migration Now

Migrations 147 and 148 were **both** corrupted when applied via copy-paste from
a web page. This migration eliminates the root cause permanently.

### Why this keeps happening

Every browser HTML-encodes `>` as `&gt;`. The PostgreSQL double-arrow operator
`->>` contains `>>`, which becomes `&gt;&gt;` in HTML source. When you copy the
text from any web page (Supabase dashboard, GitHub, etc.) the browser shows you
`->>` visually but when you paste into the SQL Editor, what arrives depends on
whether the clipboard contains the raw HTML entity text or the decoded character.

In practice, at least two applications of this fix were corrupted, leaving
`item->'id'` (single arrow → JSONB) instead of `item->>'id'` (double arrow →
TEXT). The EXCEPTION handler silently swallows the resulting type errors, so
purchase tracking **records nothing** without any visible error.

### The permanent solution

This migration replaces **all** `->>` operators with `jsonb_extract_path_text()`:

```sql
-- Before (corruption-prone):
item->>'id'        -- >> gets lost via HTML encoding
item->>'quantity'
item->>'price'

-- After (permanently safe — zero > characters):
jsonb_extract_path_text(item, 'id')
jsonb_extract_path_text(item, 'quantity')
jsonb_extract_path_text(item, 'price')
```

`jsonb_extract_path_text()` is semantically identical to `->>`. It contains
**no `>` characters** and cannot be corrupted by any HTML encoding, now or in
the future.

---

## How to Apply

### Recommended: Supabase SQL Editor (direct paste from raw file)

> Copy the SQL from a **plain text editor** (VS Code, Notepad++, etc.) that
> opens the raw file — NOT from a browser or any web page view.

1. Open the file
   `supabase/migrations/149_jsonb_extract_path_text_purchase_tracking.sql`
   in VS Code or another plain text editor.
2. Select all (`Ctrl+A`) and copy (`Ctrl+C`).
3. Open **Supabase project → SQL Editor → + New query**.
4. Paste (`Ctrl+V`) and click **RUN**.
5. Confirm the Results panel shows:
   ```
   NOTICE: Migration 149 applied: track_customer_item_purchases() uses jsonb_extract_path_text(). ...
   ```

### Alternative: psql

```bash
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" \
  -f supabase/migrations/149_jsonb_extract_path_text_purchase_tracking.sql
```

---

## Verification

Run these in the SQL Editor after applying:

```sql
-- 1. Confirm new trigger exists (should return 1 row)
SELECT tgname
FROM pg_trigger
JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
WHERE pg_class.relname = 'orders'
  AND tgname = 'trg_track_customer_purchases';

-- 2. Confirm legacy trigger is gone (should return 0 rows)
SELECT tgname
FROM pg_trigger
JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
WHERE pg_class.relname = 'orders'
  AND tgname = 'trigger_update_customer_purchases';

-- 3. Confirm function uses jsonb_extract_path_text (should appear multiple times)
SELECT pg_get_functiondef('track_customer_item_purchases'::regproc);
-- Look for: jsonb_extract_path_text(item, 'id')
-- You should NOT see: item->>'id' or item->'id'

-- 4. Confirm legacy function is gone (should return 0 rows)
SELECT proname FROM pg_proc WHERE proname = 'update_customer_purchases';
```

---

## How to verify migration 149 was NOT corrupted

Unlike previous migrations, there are **no `>` characters** to corrupt in the
key expressions. You can safely verify by checking that the live function body
contains `jsonb_extract_path_text` — this string cannot be corrupted by any
HTML encoding.

---

## What Changed

| Migration | Operator used | Contains `>`? | HTML-safe? |
|---|---|---|---|
| 142–146 | `item->>'id'` (INSERT…SELECT) | Yes | No |
| 147 | `item->>'id'` (FOR LOOP) | Yes | No — corrupted to `->` |
| 148 | `item->>'id'` (FOR LOOP) | Yes | No — corrupted again to `->` |
| **149** | `jsonb_extract_path_text(item, 'id')` | **No** | **Yes — permanent** |

---

## Related Files

- `supabase/migrations/149_jsonb_extract_path_text_purchase_tracking.sql` — SQL to run
- `supabase/migrations/RUN_MIGRATION_148.md` — Earlier instructions (same approach, still prone to corruption)
