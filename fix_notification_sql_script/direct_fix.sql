-- Create a simplified trigger function that focuses on the core functionality
CREATE OR REPLACE FUNCTION process_comment_mentions_simple()
RETURNS TRIGGER AS $$
DECLARE
  mention_pattern TEXT := '@([a-zA-Z0-9._-]+)';
  mentions TEXT[];
  mention TEXT;
  user_id_to_notify UUID;
  task_info RECORD;
BEGIN
  -- Log the execution (you can check if this trigger is even firing)
  RAISE NOTICE 'Processing mentions for comment: %', NEW.id;
  
  -- Get task info
  SELECT title, team_id, user_id INTO task_info 
  FROM tasks 
  WHERE id = NEW.task_id;
  
  -- Extract all mentions using regexp
  SELECT ARRAY(
    SELECT DISTINCT substring(m[1] from 2)
    FROM regexp_matches(NEW.content, mention_pattern, 'g') AS m
  ) INTO mentions;
  
  -- Process each mention directly
  FOREACH mention IN ARRAY mentions
  LOOP
    RAISE NOTICE 'Processing mention: %', mention;
    
    -- Find user by exact name first, then by email
    SELECT id INTO user_id_to_notify
    FROM (
      SELECT id FROM public.users WHERE lower(name) = lower(mention)
      UNION
      SELECT id FROM auth.users WHERE lower(email) = lower(mention)
    ) AS users
    LIMIT 1;
    
    IF user_id_to_notify IS NOT NULL AND user_id_to_notify != NEW.user_id THEN
      RAISE NOTICE 'Found user to notify: %', user_id_to_notify;
      
      -- Always insert the mention record regardless of team membership
      INSERT INTO comment_mentions (comment_id, user_id)
      VALUES (NEW.id, user_id_to_notify);
      
      -- Always create a notification for the mentioned user
      -- This simplified version doesn't check team membership
      INSERT INTO notifications (
        user_id,
        content,
        type,
        related_task_id,
        related_comment_id,
        related_team_id,
        actor_id
      )
      VALUES (
        user_id_to_notify,
        'You were mentioned in a comment on task "' || task_info.title || '"',
        'mention',
        NEW.task_id,
        NEW.id,
        task_info.team_id,
        NEW.user_id
      );
      
      RAISE NOTICE 'Created notification for user: %', user_id_to_notify;
    END IF;
  END LOOP;
  
  -- Always notify the task owner if they're not the commenter
  IF task_info.user_id IS NOT NULL AND task_info.user_id != NEW.user_id THEN
    INSERT INTO notifications (
      user_id,
      content,
      type,
      related_task_id,
      related_comment_id,
      related_team_id,
      actor_id
    )
    VALUES (
      task_info.user_id,
      'New comment on your task "' || task_info.title || '"',
      'comment',
      NEW.task_id,
      NEW.id,
      task_info.team_id,
      NEW.user_id
    );
    
    RAISE NOTICE 'Created notification for task owner: %', task_info.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create the trigger with the simplified function
DROP TRIGGER IF EXISTS process_comment_mentions_trigger ON task_comments;
CREATE TRIGGER process_comment_mentions_trigger
AFTER INSERT ON task_comments
FOR EACH ROW
EXECUTE FUNCTION process_comment_mentions_simple();

-- Create a direct SQL function to manually test the comment mention process
CREATE OR REPLACE FUNCTION test_mention(comment_id UUID) 
RETURNS VOID AS $$
DECLARE
  comment_record RECORD;
BEGIN
  -- Get the comment record
  SELECT * INTO comment_record FROM task_comments WHERE id = comment_id;
  
  IF comment_record IS NULL THEN
    RAISE EXCEPTION 'Comment not found with ID %', comment_id;
    RETURN;
  END IF;
  
  -- Manually call the trigger function
  PERFORM process_comment_mentions_simple();
  
  RAISE NOTICE 'Test completed for comment: %', comment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Quick query to verify notification permissions
GRANT SELECT, INSERT ON notifications TO postgres, anon, authenticated, service_role;
GRANT SELECT, INSERT ON comment_mentions TO postgres, anon, authenticated, service_role;

-- Run this to see the most recent task comments:
-- SELECT id, task_id, user_id, content, created_at FROM task_comments ORDER BY created_at DESC LIMIT 5;

-- Run this to manually process a specific comment (replace the UUID with an actual comment ID):
-- SELECT test_mention('b5a0f6d2-f7c8-4b7f-a986-e32c3e6d6eea');

-- Run this to see if notifications were created:
-- SELECT * FROM notifications ORDER BY created_at DESC LIMIT 5; 