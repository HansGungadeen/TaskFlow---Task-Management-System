export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent' | null;

export type Subtask = {
  id: string;
  task_id: string;
  title: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
  user_id: string;
};

export interface AssigneeData {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
}

export interface StatusUpdate {
  status: TaskStatus;
  updated_at: string;
  user_id?: string;
}

// Time tracking interface
export interface TimeEntry {
  id: string;
  task_id: string;
  user_id: string;
  hours: number;
  description: string | null;
  created_at: string;
  user_name?: string;
  user_email?: string;
  user_avatar_url?: string;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  user_id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  storage_path: string;
  created_at: string;
  updated_at: string;
  user?: {
    name: string | null;
    email: string | null;
  };
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  created_at: string;
  updated_at?: string;
  due_date: string | null;
  reminder_sent: boolean | null;
  has_dependencies?: boolean;
  dependencies_completed?: boolean;
  user_id: string;
  team_id?: string | null;
  assigned_to?: string | null;
  assignee_data?: AssigneeData | null;
  subtasks?: Subtask[];
  subtasks_count?: number;
  completed_subtasks_count?: number;
  status_updates?: StatusUpdate[];
  time_spent?: number;
  time_entries?: TimeEntry[];
} 