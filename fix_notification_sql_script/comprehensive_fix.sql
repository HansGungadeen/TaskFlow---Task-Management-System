-- This is a comprehensive fix for the mention and notification system
-- Step 1: Create a logging table if it doesn't exist yet
CREATE TABLE IF NOT EXISTS debug_logs (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT now(),
  message TEXT,
  data JSONB
);

-- Step 2: Drop existing triggers and functions to start fresh
DROP TRIGGER IF EXISTS process_comment_mentions_trigger ON task_comments;
DROP FUNCTION IF EXISTS process_comment_mentions;
DROP FUNCTION IF EXISTS process_comment_mentions_with_logging;
DROP FUNCTION IF EXISTS process_comment_mentions_simple;

-- Step 3: Create a fresh, completely rewritten trigger function
CREATE OR REPLACE FUNCTION handle_comment_mentions()
RETURNS TRIGGER AS $$
DECLARE
  mentioned_user_id UUID;
  task_title TEXT;
  task_owner_id UUID;
  task_team_id UUID;
  commenter_name TEXT;
  mention_text TEXT;
BEGIN
  -- Capture task information
  SELECT title, user_id, team_id 
  INTO task_title, task_owner_id, task_team_id
  FROM tasks
  WHERE id = NEW.task_id;
  
  -- Capture commenter's name or email
  SELECT COALESCE(name, email) INTO commenter_name
  FROM (
    SELECT name FROM public.users WHERE id = NEW.user_id
    UNION ALL
    SELECT email FROM auth.users WHERE id = NEW.user_id
    LIMIT 1
  ) AS user_info;
  
  -- Record function execution start
  INSERT INTO debug_logs (message, data)
  VALUES (
    'Comment mention handler started', 
    jsonb_build_object(
      'comment_id', NEW.id,
      'content', NEW.content,
      'task_id', NEW.task_id,
      'task_title', task_title
    )
  );
  
  -- Extract and process @mentions
  FOR mention_text IN 
    SELECT DISTINCT substring(matches[1] FROM 2) 
    FROM regexp_matches(NEW.content, '@([a-zA-Z0-9._-]+)', 'g') AS matches
  LOOP
    -- Log mention found
    INSERT INTO debug_logs (message, data)
    VALUES ('Found mention', jsonb_build_object('mention', mention_text));
    
    -- Find user by name
    SELECT id INTO mentioned_user_id
    FROM public.users
    WHERE lower(name) = lower(mention_text)
    LIMIT 1;
    
    -- If not found by name, try finding by email
    IF mentioned_user_id IS NULL THEN
      SELECT id INTO mentioned_user_id
      FROM auth.users
      WHERE lower(email) = lower(mention_text)
      LIMIT 1;
      
      -- Log email lookup result
      INSERT INTO debug_logs (message, data)
      VALUES (
        'Email lookup result', 
        jsonb_build_object('mention', mention_text, 'found_id', mentioned_user_id)
      );
    ELSE
      -- Log name lookup result
      INSERT INTO debug_logs (message, data)
      VALUES (
        'Name lookup result', 
        jsonb_build_object('mention', mention_text, 'found_id', mentioned_user_id)
      );
    END IF;
    
    -- Process if user found and is not the commenter
    IF mentioned_user_id IS NOT NULL AND mentioned_user_id != NEW.user_id THEN
      -- 1. Record the mention
      INSERT INTO comment_mentions (comment_id, user_id)
      VALUES (NEW.id, mentioned_user_id);
      
      -- 2. Create notification for the mentioned user
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
        mentioned_user_id,
        commenter_name || ' mentioned you in a comment on task "' || COALESCE(task_title, 'Untitled') || '"',
        'mention',
        NEW.task_id,
        NEW.id,
        task_team_id,
        NEW.user_id,
        false
      );
      
      -- Log notification creation
      INSERT INTO debug_logs (message, data)
      VALUES (
        'Created mention notification', 
        jsonb_build_object(
          'for_user_id', mentioned_user_id,
          'comment_id', NEW.id
        )
      );
    END IF;
  END LOOP;
  
  -- Create notification for task owner if not the commenter
  IF task_owner_id IS NOT NULL AND task_owner_id != NEW.user_id THEN
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
      task_owner_id,
      commenter_name || ' commented on your task "' || COALESCE(task_title, 'Untitled') || '"',
      'comment',
      NEW.task_id,
      NEW.id,
      task_team_id,
      NEW.user_id,
      false
    );
    
    -- Log owner notification
    INSERT INTO debug_logs (message, data)
    VALUES (
      'Created task owner notification', 
      jsonb_build_object(
        'task_owner_id', task_owner_id,
        'comment_id', NEW.id
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create the new trigger to run on AFTER INSERT
CREATE TRIGGER comment_mentions_trigger
AFTER INSERT ON task_comments
FOR EACH ROW
EXECUTE FUNCTION handle_comment_mentions();

-- Step 5: Ensure permissions are correctly set
-- Grant access to tables
GRANT SELECT ON tasks TO postgres, anon, authenticated, service_role;
GRANT SELECT ON public.users TO postgres, anon, authenticated, service_role;
GRANT SELECT ON auth.users TO postgres, anon, authenticated, service_role;
GRANT SELECT, INSERT ON comment_mentions TO postgres, anon, authenticated, service_role;
GRANT SELECT, INSERT ON notifications TO postgres, anon, authenticated, service_role;
GRANT SELECT, INSERT ON debug_logs TO postgres, anon, authenticated, service_role;

-- Step 6: Create a manual test function
CREATE OR REPLACE FUNCTION test_mention_on_comment(comment_id UUID)
RETURNS TEXT AS $$
DECLARE
  comment_data RECORD;
  result TEXT;
BEGIN
  -- Get the comment
  SELECT * INTO comment_data
  FROM task_comments
  WHERE id = comment_id;
  
  IF comment_data IS NULL THEN
    RETURN 'Comment not found';
  END IF;
  
  -- Clear previous debug logs for this comment
  DELETE FROM debug_logs 
  WHERE data->>'comment_id' = comment_id::TEXT;
  
  -- Manually trigger the function (since we can't re-trigger an AFTER INSERT)
  PERFORM handle_comment_mentions();
  
  -- Return success message
  RETURN 'Test completed for comment: ' || comment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usage instructions
-- 1. Run this entire SQL script to set up the system
-- 2. Add a comment with @mention through your UI
-- 3. If notifications still don't appear, check the logs:
--    SELECT * FROM debug_logs ORDER BY timestamp DESC LIMIT 20;
-- 4. You can manually test with an existing comment ID:
--    SELECT test_mention_on_comment('your-comment-uuid-here');
-- 5. Check if notifications were created:
--    SELECT * FROM notifications ORDER BY created_at DESC LIMIT 5; 