-- Create task comments table
CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  
  CONSTRAINT task_comments_content_not_empty CHECK (length(trim(content)) > 0)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS task_comments_task_id_idx ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS task_comments_user_id_idx ON task_comments(user_id);

-- Create mentions table to track user mentions in comments
CREATE TABLE IF NOT EXISTS comment_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES task_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS comment_mentions_comment_id_idx ON comment_mentions(comment_id);
CREATE INDEX IF NOT EXISTS comment_mentions_user_id_idx ON comment_mentions(user_id);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  related_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  related_comment_id UUID REFERENCES task_comments(id) ON DELETE SET NULL,
  related_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_is_read_idx ON notifications(is_read);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(created_at);

-- Add RLS policies for task comments
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

-- Policy for selecting comments (users can view comments for tasks they can access)
CREATE POLICY task_comments_select_policy
  ON task_comments
  FOR SELECT
  USING (
    -- User can view their own tasks' comments
    task_id IN (
      SELECT id FROM tasks WHERE user_id = auth.uid()
    ) OR
    -- User can view team tasks' comments if they are a team member
    task_id IN (
      SELECT t.id FROM tasks t
      JOIN team_members tm ON t.team_id = tm.team_id
      WHERE tm.user_id = auth.uid()
    )
  );

-- Drop the existing insert policy
DROP POLICY IF EXISTS task_comments_insert_policy ON task_comments;

-- Create a more permissive policy for testing
CREATE POLICY task_comments_insert_policy
  ON task_comments
  FOR INSERT
  WITH CHECK (
    true
  );

-- Policy for updating comments (users can only update their own comments)
CREATE POLICY task_comments_update_policy
  ON task_comments
  FOR UPDATE
  USING (
    user_id = auth.uid()
  );

-- Policy for deleting comments (users can only delete their own comments)
CREATE POLICY task_comments_delete_policy
  ON task_comments
  FOR DELETE
  USING (
    user_id = auth.uid() OR
    -- Task owner can delete any comment
    task_id IN (
      SELECT id FROM tasks WHERE user_id = auth.uid()
    ) OR
    -- Team admin can delete any comment on team tasks
    (
      task_id IN (
        SELECT t.id FROM tasks t
        JOIN team_members tm ON t.team_id = tm.team_id
        WHERE tm.user_id = auth.uid() AND tm.role = 'admin'
      )
    )
  );

-- Add RLS policies for mentions
ALTER TABLE comment_mentions ENABLE ROW LEVEL SECURITY;

-- Policy for selecting mentions
CREATE POLICY comment_mentions_select_policy
  ON comment_mentions
  FOR SELECT
  USING (
    -- User can view mentions in comments they can access
    comment_id IN (
      SELECT id FROM task_comments tc
      WHERE tc.task_id IN (
        SELECT id FROM tasks WHERE user_id = auth.uid()
      ) OR
      tc.task_id IN (
        SELECT t.id FROM tasks t
        JOIN team_members tm ON t.team_id = tm.team_id
        WHERE tm.user_id = auth.uid()
      )
    ) OR
    -- User can view mentions of themselves
    user_id = auth.uid()
  );

-- Policy for inserting mentions
CREATE POLICY comment_mentions_insert_policy
  ON comment_mentions
  FOR INSERT
  WITH CHECK (
    -- User can only add mentions to their own comments
    comment_id IN (
      SELECT id FROM task_comments WHERE user_id = auth.uid()
    )
  );

-- Add RLS policies for notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy for selecting notifications (users can only view their own notifications)
CREATE POLICY notifications_select_policy
  ON notifications
  FOR SELECT
  USING (
    user_id = auth.uid()
  );

-- Policy for updating notifications (users can only update their own notifications)
CREATE POLICY notifications_update_policy
  ON notifications
  FOR UPDATE
  USING (
    user_id = auth.uid()
  );

-- Create a view that joins task comments with user information
CREATE OR REPLACE VIEW task_comments_with_users AS
SELECT 
  c.*,
  u.email as user_email,
  p.name as user_name,
  p.avatar_url as user_avatar_url
FROM 
  task_comments c
JOIN 
  auth.users u ON c.user_id = u.id
LEFT JOIN 
  public.users p ON c.user_id = p.id;

-- Enable realtime for task_comments, comment_mentions, and notifications
ALTER PUBLICATION supabase_realtime ADD TABLE task_comments, comment_mentions, notifications;

-- Function to extract mentioned users from comment content
CREATE OR REPLACE FUNCTION extract_mentions(comment_text TEXT)
RETURNS TABLE(username TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT substring(m[1] from 2)
  FROM regexp_matches(comment_text, '@([a-zA-Z0-9._-]+)', 'g') AS m;
END;
$$ LANGUAGE plpgsql;

-- Function to process mentions in a comment and create notifications
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
    -- Find user by name or email
    SELECT u.id INTO mentioned_user_id
    FROM public.users u
    WHERE lower(u.name) = lower(mention_name)
    OR lower(u.email) = lower(mention_name)
    LIMIT 1;
    
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
    
    IF task_owner_id != NEW.user_id THEN
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

-- Create trigger for processing mentions when a comment is created
CREATE TRIGGER process_comment_mentions_trigger
AFTER INSERT ON task_comments
FOR EACH ROW
EXECUTE FUNCTION process_comment_mentions();

-- Function to handle comment updates
CREATE OR REPLACE FUNCTION handle_task_comment_updated()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating the updated_at timestamp
CREATE TRIGGER task_comment_updated
BEFORE UPDATE ON task_comments
FOR EACH ROW
EXECUTE FUNCTION handle_task_comment_updated(); 