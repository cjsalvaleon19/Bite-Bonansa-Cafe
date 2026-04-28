-- ============================================================================
-- Test Migration 037: Verify notifications.related_id UUID Type Fix
-- ============================================================================

-- 1. Verify notifications table exists
SELECT 'Checking notifications table...' AS test;
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'notifications'
) AS notifications_table_exists;

-- 2. Check related_id column type
SELECT 'Checking related_id column type...' AS test;
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'notifications'
AND column_name = 'related_id';

-- Expected: data_type = 'uuid' or udt_name = 'uuid'

-- 3. Verify trigger function exists
SELECT 'Checking trigger function...' AS test;
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
AND routine_name = 'notify_customer_on_order_status_change';

-- 4. Verify trigger exists on orders table
SELECT 'Checking trigger on orders table...' AS test;
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public' 
AND event_object_table = 'orders'
AND trigger_name = 'trigger_notify_customer_on_order_status';

-- 5. Test notification insert with UUID (simulating what the trigger does)
SELECT 'Testing notification insert with UUID...' AS test;

-- First, let's create a test user if needed
DO $$
DECLARE
    test_user_id UUID;
    test_order_id UUID := gen_random_uuid();
BEGIN
    -- Get or create a test customer
    SELECT id INTO test_user_id FROM users WHERE role = 'customer' LIMIT 1;
    
    IF test_user_id IS NULL THEN
        RAISE NOTICE 'No customer found - skipping insert test';
    ELSE
        -- Test insert (will rollback after)
        BEGIN
            INSERT INTO notifications (
                user_id,
                type,
                title,
                message,
                related_id,
                related_type
            ) VALUES (
                test_user_id,
                'order_status',
                'Test Notification',
                'Testing UUID type for related_id',
                test_order_id,  -- UUID value
                'order'
            );
            RAISE NOTICE 'Successfully inserted notification with UUID related_id: %', test_order_id;
            
            -- Clean up test data
            DELETE FROM notifications 
            WHERE related_id = test_order_id AND title = 'Test Notification';
            
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Failed to insert notification: %', SQLERRM;
        END;
    END IF;
END $$;

-- 6. Summary
SELECT 'Migration 037 Test Summary' AS summary;
SELECT 
    CASE 
        WHEN data_type = 'uuid' THEN '✓ related_id column is UUID type'
        ELSE '✗ related_id column is NOT UUID type: ' || data_type
    END AS result
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'notifications'
AND column_name = 'related_id';
