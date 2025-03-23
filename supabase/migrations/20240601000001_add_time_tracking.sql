-- Add time_spent column to tasks table
ALTER TABLE tasks ADD COLUMN time_spent REAL DEFAULT 0;

-- Create a new time_entries table to track individual time records
CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hours REAL NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Add constraint to ensure hours is positive
  CONSTRAINT positive_hours CHECK (hours > 0)
);

-- Create index for better performance
CREATE INDEX idx_time_entries_task_id ON time_entries(task_id);

-- Update task's time_spent when a time entry is added, updated or deleted
CREATE OR REPLACE FUNCTION update_task_time_spent()
RETURNS TRIGGER AS $$
DECLARE
  task_id_val UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    task_id_val := OLD.task_id;
  ELSE
    task_id_val := NEW.task_id;
  END IF;

  -- Update the task's time_spent with the sum of all time entries
  UPDATE tasks
  SET time_spent = COALESCE((
    SELECT SUM(hours)
    FROM time_entries
    WHERE task_id = task_id_val
  ), 0)
  WHERE id = task_id_val;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to maintain time_spent in tasks table
CREATE TRIGGER after_time_entry_insert_update
AFTER INSERT OR UPDATE ON time_entries
FOR EACH ROW
EXECUTE FUNCTION update_task_time_spent();

CREATE TRIGGER after_time_entry_delete
AFTER DELETE ON time_entries
FOR EACH ROW
EXECUTE FUNCTION update_task_time_spent();

-- Add RLS policies for time_entries
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see time entries for tasks they created or are assigned to
CREATE POLICY "Users can view time entries for their tasks"
  ON time_entries FOR SELECT
  USING (
    user_id = auth.uid() OR
    task_id IN (
      SELECT id FROM tasks 
      WHERE user_id = auth.uid() OR assigned_to = auth.uid()
    ) OR
    task_id IN (
      SELECT t.id FROM tasks t
      JOIN team_members tm ON t.team_id = tm.team_id
      WHERE tm.user_id = auth.uid()
    )
  );

-- Policy: Users can create time entries for tasks they created or are assigned to
CREATE POLICY "Users can create time entries for their tasks"
  ON time_entries FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND (
      task_id IN (
        SELECT id FROM tasks 
        WHERE user_id = auth.uid() OR assigned_to = auth.uid()
      ) OR
      task_id IN (
        SELECT t.id FROM tasks t
        JOIN team_members tm ON t.team_id = tm.team_id
        WHERE tm.user_id = auth.uid()
      )
    )
  );

-- Policy: Users can update or delete only their own time entries
CREATE POLICY "Users can update their own time entries"
  ON time_entries FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own time entries"
  ON time_entries FOR DELETE
  USING (user_id = auth.uid()); 