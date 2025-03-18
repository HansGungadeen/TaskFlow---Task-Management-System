-- Create task_history table to track changes to tasks
CREATE TABLE IF NOT EXISTS task_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_task_history_task_id ON task_history(task_id);
CREATE INDEX IF NOT EXISTS idx_task_history_user_id ON task_history(user_id);
CREATE INDEX IF NOT EXISTS idx_task_history_created_at ON task_history(created_at);

-- Enable realtime for task_history
alter publication supabase_realtime add table task_history;

-- Create function to record task changes
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

-- Create triggers to record task changes
DROP TRIGGER IF EXISTS task_audit_trigger_insert ON tasks;
CREATE TRIGGER task_audit_trigger_insert
  AFTER INSERT ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION record_task_change();

DROP TRIGGER IF EXISTS task_audit_trigger_update ON tasks;
CREATE TRIGGER task_audit_trigger_update
  AFTER UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION record_task_change();

DROP TRIGGER IF EXISTS task_audit_trigger_delete ON tasks;
CREATE TRIGGER task_audit_trigger_delete
  BEFORE DELETE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION record_task_change();
