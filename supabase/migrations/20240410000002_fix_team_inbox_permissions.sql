-- Drop the existing view and recreate it with a better approach
DROP VIEW IF EXISTS team_inbox_messages_with_users;

-- Instead of using auth.users directly, which has strict access controls,
-- create a function that safely gets user information for messages

CREATE OR REPLACE FUNCTION get_team_inbox_messages(team_id_param UUID)
RETURNS TABLE (
  id UUID,
  team_id UUID,
  user_id UUID,
  content TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  is_pinned BOOLEAN,
  has_attachment BOOLEAN,
  attachment_url TEXT,
  attachment_name TEXT,
  related_task_id UUID,
  user_email TEXT,
  user_name TEXT,
  user_avatar_url TEXT,
  related_task JSON
) SECURITY DEFINER
AS $$
BEGIN
  -- Check if the user is a member of the team
  IF NOT EXISTS (
    SELECT 1 FROM team_members 
    WHERE team_id = team_id_param AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a member of this team';
  END IF;
  
  RETURN QUERY
  SELECT 
    m.id,
    m.team_id,
    m.user_id,
    m.content,
    m.created_at,
    m.updated_at,
    m.is_pinned,
    m.has_attachment,
    m.attachment_url,
    m.attachment_name,
    m.related_task_id,
    u.email::TEXT as user_email,
    (u.raw_user_meta_data->>'name')::TEXT as user_name,
    (u.raw_user_meta_data->>'avatar_url')::TEXT as user_avatar_url,
    CASE 
      WHEN m.related_task_id IS NOT NULL THEN
        (SELECT 
          json_build_object(
            'id', t.id,
            'title', t.title,
            'status', t.status,
            'priority', t.priority,
            'due_date', t.due_date
          )
         FROM tasks t WHERE t.id = m.related_task_id)
      ELSE NULL
    END as related_task
  FROM 
    team_inbox_messages m
  JOIN 
    auth.users u ON m.user_id = u.id
  WHERE 
    m.team_id = team_id_param
  ORDER BY 
    m.is_pinned DESC, m.created_at DESC;
END;
$$ LANGUAGE plpgsql; 