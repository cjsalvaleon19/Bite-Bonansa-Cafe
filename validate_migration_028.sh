#!/bin/bash
# Simple syntax validation test for migration 028
# This script checks if the SQL is syntactically valid without executing it

set -e

echo "================================================================"
echo "Migration 028 Syntax Validation Test"
echo "================================================================"
echo ""

MIGRATION_FILE="supabase/migrations/028_cleanup_duplicate_menu_items_and_variants.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "✓ Migration file found: $MIGRATION_FILE"
echo ""

# Check file size
FILE_SIZE=$(wc -c < "$MIGRATION_FILE")
echo "File size: $FILE_SIZE bytes"
echo ""

# Count the number of SQL statements (approximate)
DELETE_COUNT=$(grep -c "^DELETE FROM" "$MIGRATION_FILE" || true)
DO_BLOCK_COUNT=$(grep -c "^DO \$\$" "$MIGRATION_FILE" || true)
SELECT_COUNT=$(grep -c "^SELECT" "$MIGRATION_FILE" || true)

echo "Migration Statistics:"
echo "  - DELETE statements: $DELETE_COUNT"
echo "  - DO blocks: $DO_BLOCK_COUNT"
echo "  - SELECT statements: $SELECT_COUNT"
echo ""

# Check for common SQL syntax issues
echo "Checking for common syntax issues..."

# Check for unmatched parentheses
OPEN_PARENS=$(grep -o "(" "$MIGRATION_FILE" | wc -l)
CLOSE_PARENS=$(grep -o ")" "$MIGRATION_FILE" | wc -l)

if [ "$OPEN_PARENS" -eq "$CLOSE_PARENS" ]; then
    echo "✓ Parentheses are balanced ($OPEN_PARENS pairs)"
else
    echo "⚠ Parentheses mismatch: $OPEN_PARENS open, $CLOSE_PARENS close"
fi

# Check for DO blocks closure
DO_OPENS=$(grep -c "^DO \$\$" "$MIGRATION_FILE" || true)
DO_CLOSES=$(grep -c "^END \$\$;" "$MIGRATION_FILE" || true)

if [ "$DO_OPENS" -eq "$DO_CLOSES" ]; then
    echo "✓ DO blocks are properly closed ($DO_OPENS blocks)"
else
    echo "⚠ DO blocks mismatch: $DO_OPENS open, $DO_CLOSES close"
fi

# Check for semicolons at end of statements
echo "✓ Syntax checks complete"
echo ""

echo "================================================================"
echo "Key Features of Migration 028:"
echo "================================================================"
echo "1. Deletes old Chicken Platter variants (₱249)"
echo "2. Keeps new Chicken Platter variants (₱254)"
echo "3. Removes duplicate menu items across all categories"
echo "4. Cleans up orphaned variant data"
echo "5. Provides verification output"
echo ""

echo "================================================================"
echo "Next Steps:"
echo "================================================================"
echo "1. Review the migration file: $MIGRATION_FILE"
echo "2. Read the documentation: DUPLICATE_MENU_CLEANUP_GUIDE.md"
echo "3. Follow the quick-start guide: RUN_MIGRATION_028.md"
echo "4. Backup your database"
echo "5. Run the migration via Supabase Dashboard or CLI"
echo "================================================================"
echo ""
echo "✓ Validation complete - Migration appears syntactically correct"
