-- This script will ensure all auth.users have corresponding entries in public.users

-- First, a function to synchronize all users
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

-- Execute the function to sync all users
SELECT sync_all_auth_users_to_public();

-- Verify the results
SELECT COUNT(*) AS auth_users_count FROM auth.users;
SELECT COUNT(*) AS public_users_count FROM public.users;

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

-- Grant permissions to the new functions
GRANT EXECUTE ON FUNCTION handle_new_user TO postgres, service_role;
GRANT EXECUTE ON FUNCTION sync_all_auth_users_to_public TO postgres, service_role; 