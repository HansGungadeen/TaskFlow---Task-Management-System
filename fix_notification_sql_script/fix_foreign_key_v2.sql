-- Create a specific function to sync a user from auth.users to public.users
CREATE OR REPLACE FUNCTION sync_auth_user_to_public(
  auth_user_id UUID
) RETURNS UUID AS $$
DECLARE
  user_exists BOOLEAN;
  user_email TEXT;
BEGIN
  -- First check if the user already exists in public.users
  SELECT EXISTS(SELECT 1 FROM public.users WHERE id = auth_user_id) INTO user_exists;
  
  -- If user doesn't exist in public.users, create them
  IF NOT user_exists THEN
    -- Get the email directly using a more privileged approach
    BEGIN
      -- Try to get email from auth.users (needs higher privileges)
      EXECUTE 'SELECT email FROM auth.users WHERE id = $1' 
      INTO user_email
      USING auth_user_id;
      
      -- If we got an email, insert the user
      IF user_email IS NOT NULL THEN
        INSERT INTO public.users (id, email)
        VALUES (auth_user_id, user_email);
        RAISE NOTICE 'Created public user record for %', auth_user_id;
      ELSE
        RAISE NOTICE 'Could not find email for user %', auth_user_id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- If we can't access auth.users, create a placeholder user
      RAISE NOTICE 'Error accessing auth.users: %, creating placeholder', SQLERRM;
      INSERT INTO public.users (id, email)
      VALUES (auth_user_id, 'user-' || auth_user_id || '@placeholder.com');
    END;
  END IF;
  
  RETURN auth_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the comment_mentions table to use UUID for ID
ALTER TABLE IF EXISTS comment_mentions
ALTER COLUMN id TYPE UUID USING id::UUID;

-- Create a version of record_comment_mention that directly handles the foreign key issue
CREATE OR REPLACE FUNCTION record_comment_mention_direct(
  p_comment_id UUID,
  p_user_id UUID
) RETURNS UUID AS $$
DECLARE
  mention_id UUID;
BEGIN
  -- First ensure the user exists in public.users
  PERFORM sync_auth_user_to_public(p_user_id);
  
  -- Then insert the mention
  INSERT INTO comment_mentions (
    comment_id,
    user_id
  ) VALUES (
    p_comment_id,
    p_user_id
  ) RETURNING id INTO mention_id;
  
  RETURN mention_id;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error in record_comment_mention_direct: %', SQLERRM;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a version of create_mention_notification that directly handles the foreign key issue
CREATE OR REPLACE FUNCTION create_mention_notification_direct(
  p_user_id UUID,
  p_content TEXT,
  p_task_id UUID,
  p_comment_id UUID,
  p_team_id UUID,
  p_actor_id UUID
) RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  -- First ensure the user exists in public.users
  PERFORM sync_auth_user_to_public(p_user_id);
  
  -- Also ensure the actor exists in public.users
  IF p_actor_id IS NOT NULL THEN
    PERFORM sync_auth_user_to_public(p_actor_id);
  END IF;
  
  -- Insert the notification
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
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error in create_mention_notification_direct: %', SQLERRM;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a version of create_comment_notification that directly handles the foreign key issue
CREATE OR REPLACE FUNCTION create_comment_notification_direct(
  p_user_id UUID,
  p_content TEXT,
  p_task_id UUID,
  p_comment_id UUID,
  p_team_id UUID,
  p_actor_id UUID
) RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  -- First ensure the user exists in public.users
  PERFORM sync_auth_user_to_public(p_user_id);
  
  -- Also ensure the actor exists in public.users
  IF p_actor_id IS NOT NULL THEN
    PERFORM sync_auth_user_to_public(p_actor_id);
  END IF;
  
  -- Insert the notification
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
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error in create_comment_notification_direct: %', SQLERRM;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION sync_auth_user_to_public TO postgres, authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION record_comment_mention_direct TO postgres, authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION create_mention_notification_direct TO postgres, authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION create_comment_notification_direct TO postgres, authenticated, anon, service_role; 