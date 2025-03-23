-- Create a stored procedure to handle notification creation from the client side
CREATE OR REPLACE FUNCTION create_mention_notification(
  p_user_id UUID,             -- User to notify
  p_content TEXT,             -- Notification content
  p_task_id UUID,             -- Related task
  p_comment_id UUID,          -- Related comment
  p_team_id UUID,             -- Related team (can be null)
  p_actor_id UUID             -- User who created the comment/mention
) RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  -- Insert the notification with elevated privileges
  INSERT INTO notifications (
    user_id,
    content,
    type,
    related_task_id,
    related_comment_id,
    related_team_id,
    actor_id,
    is_read
  ) VALUES (
    p_user_id,
    p_content,
    'mention',
    p_task_id,
    p_comment_id,
    p_team_id,
    p_actor_id,
    false
  ) RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function for comment notifications
CREATE OR REPLACE FUNCTION create_comment_notification(
  p_user_id UUID,             -- User to notify
  p_content TEXT,             -- Notification content
  p_task_id UUID,             -- Related task
  p_comment_id UUID,          -- Related comment
  p_team_id UUID,             -- Related team (can be null)
  p_actor_id UUID             -- User who created the comment/mention
) RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  -- Insert the notification with elevated privileges
  INSERT INTO notifications (
    user_id,
    content,
    type,
    related_task_id,
    related_comment_id,
    related_team_id,
    actor_id,
    is_read
  ) VALUES (
    p_user_id,
    p_content,
    'comment',
    p_task_id,
    p_comment_id,
    p_team_id,
    p_actor_id,
    false
  ) RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to record mentions
CREATE OR REPLACE FUNCTION record_comment_mention(
  p_comment_id UUID,
  p_user_id UUID
) RETURNS UUID AS $$
DECLARE
  mention_id UUID;
BEGIN
  -- Insert the mention with elevated privileges
  INSERT INTO comment_mentions (
    comment_id,
    user_id
  ) VALUES (
    p_comment_id,
    p_user_id
  ) RETURNING id INTO mention_id;
  
  RETURN mention_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_mention_notification TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION create_comment_notification TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION record_comment_mention TO authenticated, anon, service_role; 