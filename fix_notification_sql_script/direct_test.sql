-- This script lets you directly test the entire comments, mentions and notifications flow
-- without depending on triggers

-- Step 1: Find a valid task to test with
SELECT id AS task_id, title, user_id AS owner_id, team_id
FROM tasks
ORDER BY created_at DESC
LIMIT 1;

-- Step 2: Find a valid user to be the commenter (should be different from the task owner)
SELECT id AS commenter_id, email, name
FROM (
  SELECT id, email, name FROM public.users
  UNION ALL
  SELECT id, email, NULL FROM auth.users
  WHERE id NOT IN (SELECT id FROM public.users)
) AS users
LIMIT 5;

-- Step 3: Find a valid user to be mentioned (should be different from the commenter)
SELECT id AS mentioned_user_id, email, name
FROM (
  SELECT id, email, name FROM public.users
  UNION ALL
  SELECT id, email, NULL FROM auth.users
  WHERE id NOT IN (SELECT id FROM public.users)
) AS users
LIMIT 5;

-- Step 4: Manually create a test comment and mention
-- Replace these values with actual UUIDs from above queries
DO $$
DECLARE
  v_task_id UUID := 'task-uuid-from-step-1';        -- REPLACE WITH ACTUAL UUID
  v_commenter_id UUID := 'commenter-uuid-from-step-2';  -- REPLACE WITH ACTUAL UUID
  v_mentioned_user_id UUID := 'mentioned-uuid-from-step-3';  -- REPLACE WITH ACTUAL UUID
  v_comment_id UUID;
BEGIN
  -- Insert a test comment
  INSERT INTO task_comments (task_id, user_id, content)
  VALUES (v_task_id, v_commenter_id, 'This is a test comment with @username mention')
  RETURNING id INTO v_comment_id;
  
  -- Manually insert the mention record
  INSERT INTO comment_mentions (comment_id, user_id)
  VALUES (v_comment_id, v_mentioned_user_id);
  
  -- Manually create the notification
  INSERT INTO notifications (
    user_id,
    content,
    type,
    related_task_id,
    related_comment_id,
    actor_id,
    is_read
  )
  VALUES (
    v_mentioned_user_id,
    'You were mentioned in a comment',
    'mention',
    v_task_id,
    v_comment_id,
    v_commenter_id,
    false
  );
  
  RAISE NOTICE 'Created test comment with ID: %', v_comment_id;
END$$;

-- Step 5: Verify results
-- Check if the comment was created
SELECT * FROM task_comments ORDER BY created_at DESC LIMIT 1;

-- Check if the mention was recorded
SELECT * FROM comment_mentions ORDER BY created_at DESC LIMIT 1;

-- Check if the notification was created
SELECT * FROM notifications ORDER BY created_at DESC LIMIT 1; 