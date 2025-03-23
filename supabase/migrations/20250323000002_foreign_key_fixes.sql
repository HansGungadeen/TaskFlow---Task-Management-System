-- Migration: 002 - Foreign Key Constraint Fixes

-- Create a function to sync auth.users to public.users
CREATE OR REPLACE FUNCTION sync_auth_user_to_public(user_uuid UUID) RETURNS void AS $$
DECLARE
  user_exists BOOLEAN;
  user_email TEXT;
  user_name TEXT;
BEGIN
  -- First check if the user already exists in public.users
  SELECT EXISTS(
    SELECT 1 FROM public.users WHERE id = user_uuid
  ) INTO user_exists;
  
  -- If user doesn't exist yet, create them
  IF NOT user_exists THEN
    -- Try to get email from auth.users
    BEGIN
      -- Use dynamic SQL to access the auth.users table
      EXECUTE format('
        SELECT email, raw_user_meta_data->''name'' 
        FROM auth.users 
        WHERE id = %L
      ', user_uuid) INTO user_email, user_name;
      
      -- If we got the email, create the user
      IF user_email IS NOT NULL THEN
        INSERT INTO public.users (id, email, name)
        VALUES (user_uuid, user_email, user_name);
        RAISE NOTICE 'Created public user from auth data: %', user_email;
      ELSE
        RAISE NOTICE 'Could not find email for user %', user_uuid;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- If we couldn't access auth.users, use a placeholder
      RAISE NOTICE 'Error accessing auth.users: %', SQLERRM;
      
      -- Create a placeholder user
      INSERT INTO public.users (id, email, name)
      VALUES (
        user_uuid, 
        concat(user_uuid, '@placeholder.com'),
        concat('User ', substr(user_uuid::text, 1, 8))
      );
      RAISE NOTICE 'Created placeholder user for %', user_uuid;
    END;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
  
  -- Insert the mention record
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