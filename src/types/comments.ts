export interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string | null;
  // Joined fields from the view
  user_email?: string;
  user_name?: string;
  user_avatar_url?: string;
}

export interface CommentMention {
  id: string;
  comment_id: string;
  user_id: string;
  created_at: string;
}

export interface CommentWithMentions extends Comment {
  mentions: string[]; // Array of mentioned user IDs
} 