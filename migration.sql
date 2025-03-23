-- TaskFlow Complete Migration Script
-- This script combines all necessary database setup and fixes

-----------------------------------------------
-- PART 1: BASE SCHEMA SETUP
-----------------------------------------------

-- Create the tables
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date TIMESTAMPTZ,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.comment_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID REFERENCES public.task_comments(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  related_task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  related_comment_id UUID REFERENCES public.task_comments(id) ON DELETE CASCADE,
  related_team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- Create views for convenience
CREATE OR REPLACE VIEW task_comments_with_users AS
  SELECT 
    tc.*,
    u.name AS user_name,
    u.email AS user_email,
    u.avatar_url AS user_avatar_url
  FROM 
    task_comments tc
  JOIN 
    users u ON tc.user_id = u.id;

-----------------------------------------------
-- PART 2: FOREIGN KEY CONSTRAINT FIXES
-----------------------------------------------

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

-----------------------------------------------
-- PART 3: ROW LEVEL SECURITY POLICIES
-----------------------------------------------

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
CREATE POLICY users_select ON users
  FOR SELECT 
  USING (true);

-- Create policies for notifications
CREATE POLICY notifications_select ON notifications
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY notifications_update ON notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Allow service role to perform all operations
CREATE POLICY service_role_notifications ON notifications
  FOR ALL
  TO service_role
  USING (true);

-- Create policies for teams
CREATE POLICY teams_select ON teams
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM team_members 
      WHERE team_id = teams.id AND user_id = auth.uid()
    )
  );

-- Create policies for team_members
CREATE POLICY team_members_select ON team_members
  FOR SELECT 
  USING (true);

-- Create policies for tasks
CREATE POLICY tasks_select ON tasks
  FOR SELECT 
  USING (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM team_members 
      WHERE team_id = tasks.team_id AND user_id = auth.uid()
    )
  );

-- Create policies for task_comments
CREATE POLICY task_comments_select ON task_comments
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE id = task_comments.task_id AND (
        tasks.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM team_members
          WHERE team_id = tasks.team_id AND user_id = auth.uid()
        )
      )
    )
  );

-----------------------------------------------
-- PART 4: UTILITY FUNCTIONS AND TRIGGERS
-----------------------------------------------

-- Create a function to sync all auth users to public users
CREATE OR REPLACE FUNCTION sync_all_auth_users_to_public() RETURNS void AS $$
DECLARE
  auth_user_record RECORD;
  user_exists BOOLEAN;
  count_created INTEGER := 0;
  count_already_exists INTEGER := 0;
BEGIN
  -- Create a temporary table with higher privileges to access auth.users
  CREATE TEMP TABLE temp_auth_users AS
  SELECT id, email, raw_user_meta_data->>'name' as name
  FROM auth.users;
  
  -- Log how many users we found
  RAISE NOTICE 'Found % users in auth.users', (SELECT COUNT(*) FROM temp_auth_users);
  
  -- Loop through each auth user
  FOR auth_user_record IN SELECT * FROM temp_auth_users
  LOOP
    -- Check if user exists in public.users
    SELECT EXISTS(
      SELECT 1 FROM public.users WHERE id = auth_user_record.id
    ) INTO user_exists;
    
    -- If user doesn't exist, create them
    IF NOT user_exists THEN
      INSERT INTO public.users (id, email, name)
      VALUES (
        auth_user_record.id, 
        auth_user_record.email,
        auth_user_record.name
      );
      count_created := count_created + 1;
    ELSE
      count_already_exists := count_already_exists + 1;
    END IF;
  END LOOP;
  
  -- Clean up
  DROP TABLE temp_auth_users;
  
  -- Log results
  RAISE NOTICE 'Sync complete: % users created, % users already existed', 
    count_created, count_already_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to automatically sync new users
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (
    NEW.id, 
    NEW.email,
    NEW.raw_user_meta_data->>'name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Create a utility function to verify notifications
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

-----------------------------------------------
-- PART 5: PERMISSIONS
-----------------------------------------------

-- Grant permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA auth TO postgres, anon, authenticated, service_role;

-- Grant SELECT permissions on tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON public.users TO postgres, anon, authenticated, service_role;
GRANT SELECT ON auth.users TO postgres, anon, authenticated, service_role;

-- Grant INSERT, UPDATE, DELETE permissions for authenticated users
GRANT INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.task_comments TO authenticated;
GRANT INSERT ON public.teams TO authenticated;
GRANT INSERT ON public.team_members TO authenticated;
GRANT UPDATE ON public.notifications TO authenticated;

-- Grant ALL permissions to service_role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION sync_auth_user_to_public TO postgres, authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION record_comment_mention_direct TO postgres, authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION create_mention_notification_direct TO postgres, authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION create_comment_notification_direct TO postgres, authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION check_user_notifications TO postgres, authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION sync_all_auth_users_to_public TO postgres, service_role;
GRANT EXECUTE ON FUNCTION handle_new_user TO postgres, service_role;

-----------------------------------------------
-- PART 6: INITIAL DATA LOAD
-----------------------------------------------

-- Execute the function to sync all existing users
SELECT sync_all_auth_users_to_public(); 