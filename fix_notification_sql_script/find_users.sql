-- Find users that can be mentioned
-- Step 1: List all users in the system
SELECT 
  id, 
  name,
  email,
  CASE 
    WHEN name IS NOT NULL THEN '@' || name
    ELSE '@' || split_part(email, '@', 1)
  END AS mention_text
FROM (
  SELECT id, name, email FROM public.users
  UNION ALL
  SELECT id, NULL as name, email FROM auth.users
  WHERE id NOT IN (SELECT id FROM public.users)
) AS all_users
ORDER BY name, email
LIMIT 20;

-- Step 2: Test the extract_mentions function
SELECT extract_mentions('@admin Hello @user1 and @user.test.2 this is a test');

-- Step 3: Find a specific user by name or email fragment
SELECT 
  id, 
  name,
  email,
  '@' || COALESCE(name, split_part(email, '@', 1)) AS mention_text
FROM (
  SELECT id, name, email FROM public.users
  UNION ALL
  SELECT id, NULL as name, email FROM auth.users
  WHERE id NOT IN (SELECT id FROM public.users)
) AS all_users
WHERE 
  lower(name) LIKE lower('%admin%') OR
  lower(email) LIKE lower('%admin%')
ORDER BY name, email;

-- Step 4: Verify that notifications can be manually inserted
DO $$
DECLARE
  test_user_id UUID;
  test_task_id UUID;
BEGIN
  -- Get a test user
  SELECT id INTO test_user_id FROM public.users LIMIT 1;
  
  -- Get a test task
  SELECT id INTO test_task_id FROM tasks LIMIT 1;
  
  IF test_user_id IS NULL OR test_task_id IS NULL THEN
    RAISE NOTICE 'Could not find test data';
    RETURN;
  END IF;
  
  -- Insert a test notification
  INSERT INTO notifications (
    user_id,
    content,
    type,
    related_task_id,
    is_read
  )
  VALUES (
    test_user_id,
    'This is a test notification',
    'test',
    test_task_id,
    false
  );
  
  RAISE NOTICE 'Test notification created for user %', test_user_id;
END$$;

-- Check if the test notification was created
SELECT * FROM notifications WHERE type = 'test' ORDER BY created_at DESC LIMIT 1;

-- Clean up the test notification
DELETE FROM notifications WHERE type = 'test';

-- Step 5: Check existing task_comments and see which ones have mentions
SELECT
  c.id,
  c.content,
  (SELECT array_agg(username) FROM extract_mentions(c.content)) AS mentioned_users,
  c.created_at
FROM
  task_comments c
WHERE
  c.content LIKE '%@%'
ORDER BY
  c.created_at DESC
LIMIT 10; 