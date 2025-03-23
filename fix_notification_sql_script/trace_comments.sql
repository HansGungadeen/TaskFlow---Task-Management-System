-- Check the task_comments table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'task_comments';

-- Check if any comments exist in the database
SELECT id, task_id, user_id, content, created_at 
FROM task_comments
ORDER BY created_at DESC
LIMIT 10;

-- Check what triggers exist on the task_comments table
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'task_comments';

-- Test creating a comment directly through SQL and see if it triggers notifications
-- Get a valid task ID and user ID first
WITH test_data AS (
    SELECT id AS task_id, user_id 
    FROM tasks 
    ORDER BY created_at DESC 
    LIMIT 1
)
INSERT INTO task_comments (task_id, user_id, content)
SELECT task_id, user_id, 'Test comment with @mention for debugging'
FROM test_data
RETURNING id AS new_comment_id;

-- Check if the comment was added
SELECT * FROM task_comments ORDER BY created_at DESC LIMIT 1;

-- Check if any mention records were created
SELECT * FROM comment_mentions ORDER BY created_at DESC LIMIT 5;

-- Check if any notifications were created
SELECT * FROM notifications ORDER BY created_at DESC LIMIT 5;

-- Check the RLS policies on task_comments
SELECT tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'task_comments';

-- Check if the notification bell component is fetching notifications correctly
-- You'd need to check this in the code, but here we can see what the typical query would fetch
SELECT *
FROM notifications
WHERE user_id = 'REPLACE_WITH_TEST_USER_ID'
ORDER BY created_at DESC
LIMIT 10; 