-- This migration is to clean up any issues with the team inbox setup
-- First, drop any potentially problematic objects

-- Drop the view if it exists (we'll use the function approach instead)
DROP VIEW IF EXISTS team_inbox_messages_with_users;

-- Make sure the RLS policies on the team_inbox_messages table are correct
ALTER TABLE team_inbox_messages ENABLE ROW LEVEL SECURITY;

-- Drop conflicting policies if they exist
DROP POLICY IF EXISTS team_inbox_messages_select_policy ON team_inbox_messages;
DROP POLICY IF EXISTS team_inbox_messages_insert_policy ON team_inbox_messages;
DROP POLICY IF EXISTS team_inbox_messages_update_policy ON team_inbox_messages;
DROP POLICY IF EXISTS team_inbox_messages_delete_policy ON team_inbox_messages;

-- Recreate the policies
CREATE POLICY team_inbox_messages_select_policy
  ON team_inbox_messages
  FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  );

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

-- Create an alternative helpful function in case the complex one has issues
CREATE OR REPLACE FUNCTION get_simple_team_messages(team_id_param UUID)
RETURNS SETOF team_inbox_messages
SECURITY DEFINER
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
  SELECT *
  FROM team_inbox_messages
  WHERE team_id = team_id_param
  ORDER BY is_pinned DESC, created_at DESC;
END;
$$ LANGUAGE plpgsql; 