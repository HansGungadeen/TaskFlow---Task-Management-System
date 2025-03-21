-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_teams_created_by ON teams(created_by);

-- Enable RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Create team_members table with roles
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member', 'viewer')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(team_id, user_id)
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);

-- Enable RLS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Add team_id to tasks table
ALTER TABLE tasks ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_team_id ON tasks(team_id);

-- Function to check if user is a team member with at least the specified role
CREATE OR REPLACE FUNCTION public.has_team_role(
  _user_id UUID, 
  _team_id UUID, 
  _required_roles TEXT[]
) RETURNS BOOLEAN AS $$
DECLARE
  _user_role TEXT;
BEGIN
  -- Get the user's role in the team
  SELECT role INTO _user_role
  FROM team_members
  WHERE team_id = _team_id AND user_id = _user_id;
  
  -- Return true if the user's role is in the required roles
  RETURN _user_role = ANY(_required_roles);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add triggers to update the updated_at column
CREATE OR REPLACE FUNCTION update_teams_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS teams_updated_at ON teams;
CREATE TRIGGER teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_teams_updated_at();

CREATE OR REPLACE FUNCTION update_team_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS team_members_updated_at ON team_members;
CREATE TRIGGER team_members_updated_at
  BEFORE UPDATE ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION update_team_members_updated_at();

-- Create RLS policies for teams
CREATE POLICY "Team creators can do anything with their teams" ON teams
  USING (auth.uid() = created_by);

-- Create RLS policies for team_members
CREATE POLICY "Team admins can manage team members" ON team_members
  USING (
    team_id IN (
      SELECT team_id 
      FROM team_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can view teams they are members of" ON teams
  FOR SELECT
  USING (
    id IN (
      SELECT team_id 
      FROM team_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view team members for their teams" ON team_members
  FOR SELECT
  USING (
    team_id IN (
      SELECT team_id 
      FROM team_members 
      WHERE user_id = auth.uid()
    )
  );

-- Modify existing task policies to respect team roles
DROP POLICY IF EXISTS "Users can view their own tasks" ON tasks;
CREATE POLICY "Users can view their own or team tasks" ON tasks
  FOR SELECT
  USING (
    auth.uid() = user_id 
    OR (
      team_id IN (
        SELECT team_id 
        FROM team_members 
        WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert their own tasks" ON tasks;
CREATE POLICY "Users can insert their own or team tasks" ON tasks
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    OR (
      team_id IN (
        SELECT team_id 
        FROM team_members 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'member')
      )
    )
  );

DROP POLICY IF EXISTS "Users can update their own tasks" ON tasks;
CREATE POLICY "Users can update their own or team tasks" ON tasks
  FOR UPDATE
  USING (
    auth.uid() = user_id 
    OR (
      team_id IN (
        SELECT team_id 
        FROM team_members 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'member')
      )
    )
  );

DROP POLICY IF EXISTS "Users can delete their own tasks" ON tasks;
CREATE POLICY "Users can delete their own or team tasks" ON tasks
  FOR DELETE
  USING (
    auth.uid() = user_id 
    OR (
      team_id IN (
        SELECT team_id 
        FROM team_members 
        WHERE user_id = auth.uid() 
        AND role = 'admin'
      )
    )
  );

-- Update subtasks policy to consider team roles
DROP POLICY IF EXISTS "Users can view their own subtasks" ON subtasks;
CREATE POLICY "Users can view their own or team subtasks" ON subtasks
  FOR SELECT
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 
      FROM tasks t
      JOIN team_members tm ON t.team_id = tm.team_id
      WHERE t.id = subtasks.task_id 
      AND tm.user_id = auth.uid()
    )
  );

-- Enable realtime for teams and team_members
ALTER PUBLICATION supabase_realtime ADD TABLE teams, team_members; 