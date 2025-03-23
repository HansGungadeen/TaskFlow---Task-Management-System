-- Migration: 003 - Row Level Security Policies

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