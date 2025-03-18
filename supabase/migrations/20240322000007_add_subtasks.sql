-- Create subtasks table
CREATE TABLE IF NOT EXISTS subtasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  user_id UUID NOT NULL
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_user_id ON subtasks(user_id);

-- Enable realtime for subtasks
alter publication supabase_realtime add table subtasks;

-- Add trigger to update the updated_at column
CREATE OR REPLACE FUNCTION update_subtask_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS subtask_updated_at ON subtasks;
CREATE TRIGGER subtask_updated_at
  BEFORE UPDATE ON subtasks
  FOR EACH ROW
  EXECUTE FUNCTION update_subtask_updated_at();

-- Update task_history function to include subtask changes
CREATE OR REPLACE FUNCTION record_task_change()
RETURNS TRIGGER AS $$
DECLARE
  action_type TEXT;
  user_id UUID;
BEGIN
  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    action_type := 'create';
    user_id := NEW.user_id;
    
    -- Record creation as a single entry
    INSERT INTO task_history (task_id, user_id, action_type, field_name, old_value, new_value)
    VALUES (NEW.id, user_id, action_type, 'task', NULL, json_build_object('title', NEW.title, 'status', NEW.status, 'priority', NEW.priority, 'description', NEW.description, 'due_date', NEW.due_date)::text);
    
  ELSIF TG_OP = 'UPDATE' THEN
    action_type := 'update';
    user_id := NEW.user_id;
    
    -- Record changes for each modified field
    IF OLD.title IS DISTINCT FROM NEW.title THEN
      INSERT INTO task_history (task_id, user_id, action_type, field_name, old_value, new_value)
      VALUES (NEW.id, user_id, action_type, 'title', OLD.title, NEW.title);
    END IF;
    
    IF OLD.description IS DISTINCT FROM NEW.description THEN
      INSERT INTO task_history (task_id, user_id, action_type, field_name, old_value, new_value)
      VALUES (NEW.id, user_id, action_type, 'description', OLD.description, NEW.description);
    END IF;
    
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO task_history (task_id, user_id, action_type, field_name, old_value, new_value)
      VALUES (NEW.id, user_id, action_type, 'status', OLD.status, NEW.status);
    END IF;
    
    IF OLD.priority IS DISTINCT FROM NEW.priority THEN
      INSERT INTO task_history (task_id, user_id, action_type, field_name, old_value, new_value)
      VALUES (NEW.id, user_id, action_type, 'priority', OLD.priority, NEW.priority);
    END IF;
    
    IF OLD.due_date IS DISTINCT FROM NEW.due_date THEN
      INSERT INTO task_history (task_id, user_id, action_type, field_name, old_value, new_value)
      VALUES (NEW.id, user_id, action_type, 'due_date', OLD.due_date::text, NEW.due_date::text);
    END IF;
    
  ELSIF TG_OP = 'DELETE' THEN
    action_type := 'delete';
    user_id := OLD.user_id;
    
    -- Record deletion
    INSERT INTO task_history (task_id, user_id, action_type, field_name, old_value, new_value)
    VALUES (OLD.id, user_id, action_type, 'task', json_build_object('title', OLD.title, 'status', OLD.status, 'priority', OLD.priority, 'description', OLD.description, 'due_date', OLD.due_date)::text, NULL);
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
