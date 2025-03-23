-- Check what users exist in the system that could be mentioned
SELECT id, name, email FROM public.users LIMIT 20;

-- Check auth users to make sure they're properly linked
SELECT id, email FROM auth.users LIMIT 20;

-- Test the extract_mentions function directly on a sample mention
SELECT * FROM extract_mentions('@testuser');

-- Try a direct insert to notifications to check permissions
INSERT INTO notifications (
  user_id,
  content,
  type,
  is_read,
  created_at
)
SELECT 
  id,
  'Test notification',
  'test',
  false,
  now()
FROM public.users
LIMIT 1;

-- Check if the test notification was created
SELECT * FROM notifications ORDER BY created_at DESC LIMIT 1;

-- Drop the test notification
DELETE FROM notifications WHERE type = 'test';

-- Check for any error logs in the system
SELECT * FROM debug_logs ORDER BY timestamp DESC LIMIT 20; 