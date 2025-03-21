-- Add assigned_to column to tasks
ALTER TABLE tasks ADD COLUMN assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);

-- Update task_history to include assigned_to changes
ALTER TABLE task_history ADD COLUMN assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add change_type column to task_history if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'task_history' AND column_name = 'change_type'
  ) THEN
    ALTER TABLE task_history ADD COLUMN change_type TEXT;
  END IF;
END
$$;

-- Create function to update task history when assigned_to changes
CREATE OR REPLACE FUNCTION log_task_assignment_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    INSERT INTO task_history (
      task_id,
      user_id,
      change_type,
      assigned_to
    ) VALUES (
      NEW.id,
      auth.uid(),
      'assignment',
      NEW.assigned_to
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add the trigger to the tasks table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'log_task_assignment_change_trigger'
  ) THEN
    CREATE TRIGGER log_task_assignment_change_trigger
    AFTER UPDATE OF assigned_to ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION log_task_assignment_change();
  END IF;
END
$$; 