-- Grant permissions for the RLS function to access necessary tables
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA auth TO postgres, anon, authenticated, service_role;

-- Grant SELECT permissions on specific tables
GRANT SELECT ON public.users TO postgres, anon, authenticated, service_role;
GRANT SELECT ON auth.users TO postgres, anon, authenticated, service_role;
GRANT SELECT ON public.tasks TO postgres, anon, authenticated, service_role;
GRANT SELECT ON public.team_members TO postgres, anon, authenticated, service_role;

-- Grant INSERT permissions for the tables the trigger needs to modify
GRANT INSERT ON public.comment_mentions TO postgres, anon, authenticated, service_role;
GRANT INSERT ON public.notifications TO postgres, anon, authenticated, service_role;

-- Fix the permissions issue with the process_comment_mentions function
ALTER FUNCTION process_comment_mentions() SECURITY DEFINER;

-- Update the commented_added trigger to use the security definer function
DROP TRIGGER IF EXISTS process_comment_mentions_trigger ON task_comments;
CREATE TRIGGER process_comment_mentions_trigger
AFTER INSERT ON task_comments
FOR EACH ROW
EXECUTE FUNCTION process_comment_mentions(); 