-- Create the team inbox messages table
CREATE TABLE IF NOT EXISTS team_inbox_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  has_attachment BOOLEAN NOT NULL DEFAULT false,
  attachment_url TEXT,
  attachment_name TEXT,
  related_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  
  CONSTRAINT team_inbox_messages_content_not_empty CHECK (length(trim(content)) > 0)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS team_inbox_messages_team_id_idx ON team_inbox_messages(team_id);
CREATE INDEX IF NOT EXISTS team_inbox_messages_user_id_idx ON team_inbox_messages(user_id);
CREATE INDEX IF NOT EXISTS team_inbox_messages_is_pinned_idx ON team_inbox_messages(is_pinned);
CREATE INDEX IF NOT EXISTS team_inbox_messages_related_task_id_idx ON team_inbox_messages(related_task_id);

-- Add RLS policies for team inbox messages
ALTER TABLE team_inbox_messages ENABLE ROW LEVEL SECURITY;

-- Policy for selecting messages (users can only see messages for teams they're a member of)
CREATE POLICY team_inbox_messages_select_policy
  ON team_inbox_messages
  FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  );

-- Policy for inserting messages (users can only create messages for teams they're a member of)
CREATE POLICY team_inbox_messages_insert_policy
  ON team_inbox_messages
  FOR INSERT
  WITH CHECK (
    -- User must be a member or admin of the team
    team_id IN (
      SELECT team_id FROM team_members 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'member')
    ) AND
    -- User can only create messages as themselves
    user_id = auth.uid()
  );

-- Policy for updating messages (users can only update their own messages)
CREATE POLICY team_inbox_messages_update_policy
  ON team_inbox_messages
  FOR UPDATE
  USING (
    user_id = auth.uid() OR
    -- Team admins can update any message in their team
    (
      team_id IN (
        SELECT team_id FROM team_members 
        WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- Policy for deleting messages (users can only delete their own messages)
CREATE POLICY team_inbox_messages_delete_policy
  ON team_inbox_messages
  FOR DELETE
  USING (
    user_id = auth.uid() OR
    -- Team admins can delete any message in their team
    (
      team_id IN (
        SELECT team_id FROM team_members 
        WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- Create a view that joins team inbox messages with user information
CREATE OR REPLACE VIEW team_inbox_messages_with_users AS
SELECT 
  m.*,
  u.email as user_email,
  p.name as user_name,
  p.avatar_url as user_avatar_url
FROM 
  team_inbox_messages m
JOIN 
  auth.users u ON m.user_id = u.id
LEFT JOIN 
  public.users p ON m.user_id = p.id;

-- Add RLS policy for the view - use correct syntax for PostgreSQL
ALTER VIEW team_inbox_messages_with_users SET (security_invoker = true);

-- Create notification functions and triggers for real-time updates
CREATE OR REPLACE FUNCTION public.handle_team_inbox_message_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Notify about new message
    PERFORM pg_notify(
      'team_inbox_messages',
      json_build_object(
        'type', 'INSERT',
        'record', row_to_json(NEW),
        'team_id', NEW.team_id
      )::text
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Notify about updated message
    PERFORM pg_notify(
      'team_inbox_messages',
      json_build_object(
        'type', 'UPDATE',
        'record', row_to_json(NEW),
        'team_id', NEW.team_id
      )::text
    );
  ELSIF TG_OP = 'DELETE' THEN
    -- Notify about deleted message
    PERFORM pg_notify(
      'team_inbox_messages',
      json_build_object(
        'type', 'DELETE',
        'record', row_to_json(OLD),
        'team_id', OLD.team_id
      )::text
    );
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for real-time updates
CREATE TRIGGER team_inbox_message_changed
AFTER INSERT OR UPDATE OR DELETE ON team_inbox_messages
FOR EACH ROW EXECUTE PROCEDURE handle_team_inbox_message_change(); 