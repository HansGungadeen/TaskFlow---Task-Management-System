-- Update the functions to handle missing users in public.users

-- First, create a function to ensure a user exists in public.users
CREATE OR REPLACE FUNCTION ensure_public_user(
  auth_user_id UUID
) RETURNS UUID AS $$
DECLARE
  user_exists BOOLEAN;
BEGIN
  -- Check if user exists in public.users
  SELECT EXISTS(SELECT 1 FROM public.users WHERE id = auth_user_id) INTO user_exists;
  
  -- If user doesn't exist in public.users but exists in auth.users, create it
  IF NOT user_exists THEN
    -- Get user email from auth.users
    DECLARE
      user_email TEXT;
    BEGIN
      SELECT email INTO user_email FROM auth.users WHERE id = auth_user_id;
      
      IF user_email IS NOT NULL THEN
        -- Insert into public.users
        INSERT INTO public.users (id, email)
        VALUES (auth_user_id, user_email);
      END IF;
    END;
  END IF;
  
  RETURN auth_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update record_comment_mention to ensure user exists
CREATE OR REPLACE FUNCTION record_comment_mention(
  p_comment_id UUID,
  p_user_id UUID
) RETURNS UUID AS $$
DECLARE
  mention_id UUID;
  valid_user_id UUID;
BEGIN
  -- First ensure the user exists in public.users
  valid_user_id := ensure_public_user(p_user_id);
  
  -- Then insert the mention with elevated privileges
  INSERT INTO comment_mentions (
    comment_id,
    user_id
  ) VALUES (
    p_comment_id,
    valid_user_id
  ) RETURNING id INTO mention_id;
  
  RETURN mention_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update create_mention_notification to ensure user exists
CREATE OR REPLACE FUNCTION create_mention_notification(
  p_user_id UUID,
  p_content TEXT,
  p_task_id UUID,
  p_comment_id UUID,
  p_team_id UUID,
  p_actor_id UUID
) RETURNS UUID AS $$
DECLARE
  notification_id UUID;
  valid_user_id UUID;
BEGIN
  -- First ensure the user exists in public.users
  valid_user_id := ensure_public_user(p_user_id);
  
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
    valid_user_id,
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

-- Update create_comment_notification to ensure user exists
CREATE OR REPLACE FUNCTION create_comment_notification(
  p_user_id UUID,
  p_content TEXT,
  p_task_id UUID,
  p_comment_id UUID,
  p_team_id UUID,
  p_actor_id UUID
) RETURNS UUID AS $$
DECLARE
  notification_id UUID;
  valid_user_id UUID;
BEGIN
  -- First ensure the user exists in public.users
  valid_user_id := ensure_public_user(p_user_id);
  
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
    valid_user_id,
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION ensure_public_user TO postgres, authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION record_comment_mention TO postgres, authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION create_mention_notification TO postgres, authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION create_comment_notification TO postgres, authenticated, anon, service_role; 