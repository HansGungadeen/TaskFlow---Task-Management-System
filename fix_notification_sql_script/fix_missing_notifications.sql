-- Fix for self-mention notifications not showing in the UI

-- First, ensure RLS is enabled on the notifications table
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create policies to allow users to read their own notifications
CREATE POLICY notifications_select ON notifications
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Allow authenticated users to update their own notifications (for marking as read)
CREATE POLICY notifications_update ON notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Allow service role to perform all operations
CREATE POLICY service_role_notifications ON notifications
  FOR ALL
  TO service_role
  USING (true);

-- Double check permissions are properly granted
GRANT SELECT, UPDATE ON notifications TO authenticated;
GRANT ALL ON notifications TO service_role;

-- Use this to verify existing notifications for the current user
CREATE OR REPLACE FUNCTION check_user_notifications(p_user_id UUID) RETURNS TABLE (
  id UUID,
  content TEXT,
  is_read BOOLEAN,
  created_at TIMESTAMPTZ,
  type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT n.id, n.content, n.is_read, n.created_at, n.type
  FROM notifications n
  WHERE n.user_id = p_user_id
  ORDER BY n.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_user_notifications TO postgres, authenticated, anon, service_role; 