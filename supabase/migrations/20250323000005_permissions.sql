-- Migration: 005 - Permissions and Grants

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