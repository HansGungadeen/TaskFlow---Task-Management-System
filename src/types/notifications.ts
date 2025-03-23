export type NotificationType = 'mention' | 'comment' | 'task_assignment' | 'task_update' | 'team_invite';

export interface Notification {
  id: string;
  user_id: string;
  content: string;
  type: NotificationType;
  is_read: boolean;
  created_at: string;
  related_task_id: string | null;
  related_comment_id: string | null;
  related_team_id: string | null;
  actor_id: string | null;
  // Optional joined fields
  actor_name?: string;
  actor_email?: string;
  actor_avatar_url?: string;
  task_title?: string;
  team_name?: string;
} 