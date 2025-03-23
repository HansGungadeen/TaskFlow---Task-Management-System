-- First, check if the extract_mentions function works correctly
SELECT * FROM extract_mentions('@johndoe');

-- Create a logging table to help debug the trigger function
CREATE TABLE IF NOT EXISTS debug_logs (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT now(),
  message TEXT,
  data JSONB
);

-- Create an enhanced version of the trigger function with detailed logging
CREATE OR REPLACE FUNCTION process_mentions_with_debug()
RETURNS TRIGGER AS $$
DECLARE
  mention TEXT;
  user_id_to_notify UUID;
  task_info RECORD;
BEGIN
  -- Log function entry
  INSERT INTO debug_logs (message, data)
  VALUES ('Processing comment mentions', jsonb_build_object(
    'comment_id', NEW.id,
    'task_id', NEW.task_id,
    'user_id', NEW.user_id,
    'content', NEW.content
  ));
  
  -- Get task info
  SELECT title, team_id, user_id INTO task_info 
  FROM tasks 
  WHERE id = NEW.task_id;
  
  -- Log task info
  INSERT INTO debug_logs (message, data)
  VALUES ('Task info', jsonb_build_object(
    'task_id', NEW.task_id,
    'title', task_info.title,
    'team_id', task_info.team_id,
    'owner_id', task_info.user_id
  ));
  
  -- Extract mentions
  FOR mention IN SELECT * FROM extract_mentions(NEW.content)
  LOOP
    -- Log extracted mention
    INSERT INTO debug_logs (message, data)
    VALUES ('Mention extracted', jsonb_build_object('mention', mention));
    
    -- Try to find user by name
    SELECT id INTO user_id_to_notify
    FROM public.users
    WHERE lower(name) = lower(mention)
    LIMIT 1;
    
    -- Log name lookup result
    INSERT INTO debug_logs (message, data)
    VALUES ('Name lookup result', jsonb_build_object(
      'mention', mention,
      'found_id', user_id_to_notify
    ));
    
    -- If not found by name, try email
    IF user_id_to_notify IS NULL THEN
      SELECT id INTO user_id_to_notify
      FROM auth.users
      WHERE lower(email) = lower(mention)
      LIMIT 1;
      
      -- Log email lookup result
      INSERT INTO debug_logs (message, data)
      VALUES ('Email lookup result', jsonb_build_object(
        'mention', mention,
        'found_id', user_id_to_notify
      ));
    END IF;
    
    -- If found a user and it's not the commenter
    IF user_id_to_notify IS NOT NULL AND user_id_to_notify != NEW.user_id THEN
      -- Log user found
      INSERT INTO debug_logs (message, data)
      VALUES ('User found for mention', jsonb_build_object(
        'mention', mention,
        'user_id', user_id_to_notify
      ));
      
      -- Try to record the mention
      BEGIN
        INSERT INTO comment_mentions (comment_id, user_id)
        VALUES (NEW.id, user_id_to_notify);
        
        -- Log mention record creation
        INSERT INTO debug_logs (message, data)
        VALUES ('Mention record created', jsonb_build_object(
          'comment_id', NEW.id,
          'user_id', user_id_to_notify
        ));
      EXCEPTION WHEN OTHERS THEN
        -- Log error
        INSERT INTO debug_logs (message, data)
        VALUES ('Error creating mention record', jsonb_build_object(
          'error', SQLERRM,
          'comment_id', NEW.id,
          'user_id', user_id_to_notify
        ));
      END;
      
      -- Try to create a notification
      BEGIN
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
        
        -- Log notification creation
        INSERT INTO debug_logs (message, data)
        VALUES ('Notification created', jsonb_build_object(
          'for_user_id', user_id_to_notify,
          'type', 'mention',
          'task_id', NEW.task_id
        ));
      EXCEPTION WHEN OTHERS THEN
        -- Log error
        INSERT INTO debug_logs (message, data)
        VALUES ('Error creating notification', jsonb_build_object(
          'error', SQLERRM,
          'for_user_id', user_id_to_notify,
          'task_id', NEW.task_id
        ));
      END;
    ELSE
      -- Log why notification wasn't created
      INSERT INTO debug_logs (message, data)
      VALUES ('No notification created', jsonb_build_object(
        'reason', CASE
          WHEN user_id_to_notify IS NULL THEN 'User not found'
          WHEN user_id_to_notify = NEW.user_id THEN 'User is commenter'
          ELSE 'Unknown reason'
        END,
        'mention', mention
      ));
    END IF;
  END LOOP;
  
  -- Also notify task owner if not the commenter
  IF task_info.user_id IS NOT NULL AND task_info.user_id != NEW.user_id THEN
    -- Try to create a notification for task owner
    BEGIN
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
      
      -- Log notification creation
      INSERT INTO debug_logs (message, data)
      VALUES ('Owner notification created', jsonb_build_object(
        'owner_id', task_info.user_id,
        'task_id', NEW.task_id
      ));
    EXCEPTION WHEN OTHERS THEN
      -- Log error
      INSERT INTO debug_logs (message, data)
      VALUES ('Error creating owner notification', jsonb_build_object(
        'error', SQLERRM,
        'owner_id', task_info.user_id,
        'task_id', NEW.task_id
      ));
    END;
  END IF;
  
  -- Log function completion
  INSERT INTO debug_logs (message, data)
  VALUES ('Mention processing complete', jsonb_build_object('comment_id', NEW.id));
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Replace the existing trigger with the debug version
DROP TRIGGER IF EXISTS process_comment_mentions ON task_comments;
CREATE TRIGGER process_comment_mentions
AFTER INSERT ON task_comments
FOR EACH ROW
EXECUTE FUNCTION process_mentions_with_debug();

-- Query to check debug logs after adding a comment
-- SELECT * FROM debug_logs ORDER BY id DESC LIMIT 20;

-- Query to check existing notifications
-- SELECT * FROM notifications ORDER BY created_at DESC LIMIT 10;

-- Query to check task comments
-- SELECT * FROM task_comments ORDER BY created_at DESC LIMIT 10;

-- Step 5: Add a test comment with a mention that should work
-- Replace 'admin' with an actual username that exists in your system
INSERT INTO task_comments (
  task_id,
  user_id,
  content
)
SELECT 
  id AS task_id,
  (SELECT id FROM public.users WHERE id != user_id LIMIT 1) AS commenter_id,
  'Testing the mention system with @admin'
FROM tasks
ORDER BY created_at DESC
LIMIT 1
RETURNING id; 