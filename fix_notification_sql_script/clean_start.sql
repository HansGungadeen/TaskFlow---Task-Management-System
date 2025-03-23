-- Fresh implementation of the mention and notification system
-- Step 1: Clean up existing components
DROP TRIGGER IF EXISTS process_comment_mentions_trigger ON task_comments;
DROP TRIGGER IF EXISTS comment_mentions_trigger ON task_comments;
DROP FUNCTION IF EXISTS process_comment_mentions;
DROP FUNCTION IF EXISTS handle_comment_mentions;
DROP FUNCTION IF EXISTS process_comment_mentions_with_logging;
DROP FUNCTION IF EXISTS process_comment_mentions_simple;
DROP FUNCTION IF EXISTS test_mention_on_comment;
DROP FUNCTION IF EXISTS extract_mentions;

-- Step 2: Create a simple function to extract mentions
CREATE OR REPLACE FUNCTION extract_mentions(comment_text TEXT)
RETURNS TABLE(username TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT substring(m[1] from 2)
  FROM regexp_matches(comment_text, '@([a-zA-Z0-9._-]+)', 'g') AS m;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create a simple trigger function to process mentions and create notifications
CREATE OR REPLACE FUNCTION process_mentions() 
RETURNS TRIGGER AS $$
DECLARE
  mention TEXT;
  user_id_to_notify UUID;
  task_info RECORD;
BEGIN
  -- Get task info
  SELECT title, team_id, user_id INTO task_info 
  FROM tasks 
  WHERE id = NEW.task_id;
  
  -- Process each mention
  FOR mention IN SELECT * FROM extract_mentions(NEW.content)
  LOOP
    -- Try to find user by name
    SELECT id INTO user_id_to_notify
    FROM public.users
    WHERE lower(name) = lower(mention)
    LIMIT 1;
    
    -- If not found by name, try email
    IF user_id_to_notify IS NULL THEN
      SELECT id INTO user_id_to_notify
      FROM auth.users
      WHERE lower(email) = lower(mention)
      LIMIT 1;
    END IF;
    
    -- If found a user and it's not the commenter
    IF user_id_to_notify IS NOT NULL AND user_id_to_notify != NEW.user_id THEN
      -- Record the mention
      INSERT INTO comment_mentions (comment_id, user_id)
      VALUES (NEW.id, user_id_to_notify);
      
      -- Create a notification
      INSERT INTO notifications (
        user_id,
        content,
        type,
        related_task_id,
        related_comment_id,
        related_team_id,
        actor_id,
        is_read
      )
      VALUES (
        user_id_to_notify,
        'You were mentioned in a comment on task "' || COALESCE(task_info.title, 'Untitled') || '"',
        'mention',
        NEW.task_id,
        NEW.id,
        task_info.team_id,
        NEW.user_id,
        false
      );
    END IF;
  END LOOP;
  
  -- Also notify task owner if not the commenter
  IF task_info.user_id IS NOT NULL AND task_info.user_id != NEW.user_id THEN
    INSERT INTO notifications (
      user_id,
      content,
      type,
      related_task_id,
      related_comment_id,
      related_team_id,
      actor_id,
      is_read
    )
    VALUES (
      task_info.user_id,
      'New comment on your task "' || COALESCE(task_info.title, 'Untitled') || '"',
      'comment',
      NEW.task_id,
      NEW.id,
      task_info.team_id,
      NEW.user_id,
      false
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create trigger
CREATE TRIGGER process_comment_mentions
AFTER INSERT ON task_comments
FOR EACH ROW
EXECUTE FUNCTION process_mentions();

-- Step 5: Ensure permissions are set correctly
-- Grant permissions to access the necessary tables
GRANT SELECT ON tasks TO postgres, anon, authenticated, service_role;
GRANT SELECT ON public.users TO postgres, anon, authenticated, service_role;
GRANT SELECT ON auth.users TO postgres, anon, authenticated, service_role;
GRANT ALL ON comment_mentions TO postgres, anon, authenticated, service_role;
GRANT ALL ON notifications TO postgres, anon, authenticated, service_role;

-- Step 6: Test the new functionality with a direct insertion
DO $$
DECLARE
  test_task_id UUID;
  test_user_id UUID;
  test_comment_id UUID;
BEGIN
  -- Get a test task and user
  SELECT id, user_id INTO test_task_id, test_user_id FROM tasks LIMIT 1;
  
  IF test_task_id IS NULL OR test_user_id IS NULL THEN
    RAISE EXCEPTION 'No tasks found for testing';
  END IF;
  
  -- Insert a test comment
  INSERT INTO task_comments (task_id, user_id, content)
  VALUES (test_task_id, test_user_id, 'Testing mentions system with @admin')
  RETURNING id INTO test_comment_id;
  
  RAISE NOTICE 'Test comment created with ID: %', test_comment_id;
END$$; 