-- Updated function to correctly process mentions in comments and create notifications
CREATE OR REPLACE FUNCTION process_comment_mentions()
RETURNS TRIGGER AS $$
DECLARE
  mention_name TEXT;
  mentioned_user_id UUID;
  task_title TEXT;
  team_id UUID;
  comment_user_name TEXT;
BEGIN
  -- Get comment author's name
  SELECT name INTO comment_user_name
  FROM public.users
  WHERE id = NEW.user_id;
  
  IF comment_user_name IS NULL THEN
    SELECT email INTO comment_user_name
    FROM auth.users
    WHERE id = NEW.user_id;
  END IF;
  
  -- Get task information
  SELECT t.title, t.team_id INTO task_title, team_id
  FROM tasks t
  WHERE t.id = NEW.task_id;
  
  -- Extract mentions and process each one
  FOR mention_name IN SELECT * FROM extract_mentions(NEW.content)
  LOOP
    -- Fixed: Find user by name first from users table
    SELECT u.id INTO mentioned_user_id
    FROM public.users u
    WHERE lower(u.name) = lower(mention_name)
    LIMIT 1;
    
    -- If not found by name, try finding by email
    IF mentioned_user_id IS NULL THEN
      SELECT u.id INTO mentioned_user_id
      FROM auth.users u
      WHERE lower(u.email) = lower(mention_name)
      LIMIT 1;
    END IF;
    
    -- Debug logging - uncomment to troubleshoot
    -- RAISE NOTICE 'Mention: %, User ID: %', mention_name, mentioned_user_id;
    
    -- If we found a user and it's not the commenter
    IF mentioned_user_id IS NOT NULL AND mentioned_user_id != NEW.user_id THEN
      -- Insert mention record
      INSERT INTO comment_mentions (comment_id, user_id)
      VALUES (NEW.id, mentioned_user_id);
      
      -- Check if mentioned user is part of the task's team (if it's a team task)
      IF team_id IS NOT NULL THEN
        -- Only create notification if user is in the team
        IF EXISTS (
          SELECT 1 FROM team_members
          WHERE team_id = team_id AND user_id = mentioned_user_id
        ) THEN
          -- Create notification for the mentioned user
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
            mentioned_user_id,
            comment_user_name || ' mentioned you in a comment on task "' || task_title || '"',
            'mention',
            NEW.task_id,
            NEW.id,
            team_id,
            NEW.user_id
          );
        END IF;
      ELSE
        -- For personal tasks, create notification if the mentioned user is the task owner
        IF EXISTS (
          SELECT 1 FROM tasks
          WHERE id = NEW.task_id AND user_id = mentioned_user_id
        ) THEN
          -- Create notification for the mentioned user
          INSERT INTO notifications (
            user_id,
            content,
            type,
            related_task_id,
            related_comment_id,
            actor_id
          )
          VALUES (
            mentioned_user_id,
            comment_user_name || ' mentioned you in a comment on task "' || task_title || '"',
            'mention',
            NEW.task_id,
            NEW.id,
            NEW.user_id
          );
        END IF;
      END IF;
    END IF;
  END LOOP;
  
  -- Always create notification for task owner if commenter is not the owner
  DECLARE
    task_owner_id UUID;
  BEGIN
    SELECT user_id INTO task_owner_id FROM tasks WHERE id = NEW.task_id;
    
    IF task_owner_id IS NOT NULL AND task_owner_id != NEW.user_id THEN
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
        task_owner_id,
        comment_user_name || ' commented on your task "' || task_title || '"',
        'comment',
        NEW.task_id,
        NEW.id,
        team_id,
        NEW.user_id
      );
    END IF;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql; 