"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/utils";
import { Comment, CommentWithMentions } from "@/types/comments";
import { User } from "@/types/user";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { formatDistanceToNow } from "date-fns";
import { Send, Trash2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";

interface UserSuggestionListProps {
  users: User[];
  query: string;
  onSelectUser: (user: User) => void;
}

function UserSuggestionList({ 
  users, 
  query, 
  onSelectUser 
}: UserSuggestionListProps) {
  // Filter users based on query
  const filteredUsers = users.filter(user => {
    const nameMatch = user.name?.toLowerCase().includes(query.toLowerCase());
    const emailMatch = user.email.toLowerCase().includes(query.toLowerCase());
    return nameMatch || emailMatch;
  });
  
  // Return early if no results
  if (filteredUsers.length === 0) {
    return (
      <div className="p-2 shadow-md bg-background border rounded-md">
        <div className="text-sm p-2 text-muted-foreground">
          No users found
        </div>
      </div>
    );
  }
  
  // Get user initials for avatar
  const getUserInitials = (name?: string, email?: string): string => {
    if (name && name.length > 0) {
      const nameParts = name.split(' ');
      if (nameParts.length >= 2) {
        return (nameParts[0][0] + nameParts[1][0]).toUpperCase();
      }
      return name[0].toUpperCase();
    }
    if (email && email.length > 0) {
      return email[0].toUpperCase();
    }
    return '?';
  };
  
  return (
    <div className="p-1 shadow-md bg-background border rounded-md">
      <ul className="max-h-48 overflow-y-auto">
        {filteredUsers.map(user => (
          <li 
            key={user.id}
            className="px-2 py-1.5 flex items-center gap-2 hover:bg-secondary rounded cursor-pointer"
            onClick={() => onSelectUser(user)}
          >
            <Avatar className="w-6 h-6">
              <AvatarImage src={user.avatar_url || ''} alt={user.name || user.email} />
              <AvatarFallback>{getUserInitials(user.name, user.email)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              {user.name && <span className="text-sm font-medium">{user.name}</span>}
              <span className="text-xs text-muted-foreground">{user.email}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

type TaskCommentsProps = {
  taskId: string;
  teamId: string | null;
  currentUser: User;
};

export default function TaskComments({
  taskId,
  teamId,
  currentUser,
}: TaskCommentsProps) {
  const supabase = createClient();
  const [comments, setComments] = useState<CommentWithMentions[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [triggeredMention, setTriggeredMention] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const commentsContainerRef = useRef<HTMLDivElement>(null);
  
  // Scroll to the latest comment when comments are loaded or added
  useEffect(() => {
    if (comments.length > 0 && commentsContainerRef.current) {
      const container = commentsContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [comments.length]);
  
  // Load comments and team members on mount
  useEffect(() => {
    fetchComments();
    if (teamId) {
      fetchTeamMembers();
    }
    
    // Set up real-time subscription for comments
    const commentsSubscription = supabase
      .channel('task_comments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_comments',
          filter: `task_id=eq.${taskId}`
        },
        () => {
          fetchComments();
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(commentsSubscription);
    };
  }, [taskId, teamId]);
  
  // Function to get comments for this task
  const fetchComments = async () => {
    try {
      setIsLoading(true);
      
      // Get comments with user details
      const { data: commentsData, error: commentsError } = await supabase
        .from('task_comments_with_users')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });
        
      if (commentsError) throw commentsError;
      
      // Get mentions for all comments
      const commentIds = commentsData.map(comment => comment.id);
      
      let mentionsData: any[] = [];
      if (commentIds.length > 0) {
        const { data: mentions, error: mentionsError } = await supabase
          .from('comment_mentions')
          .select('*')
          .in('comment_id', commentIds);
          
        if (mentionsError) throw mentionsError;
        mentionsData = mentions || [];
      }
      
      // Map mentions to their comments
      const commentsWithMentions = commentsData.map(comment => {
        const mentions = mentionsData
          .filter(mention => mention.comment_id === comment.id)
          .map(mention => mention.user_id);
          
        return {
          ...comment,
          mentions
        };
      });
      
      setComments(commentsWithMentions);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Function to get team members for mentions
  const fetchTeamMembers = async () => {
    if (!teamId) return;
    
    try {
      // First get the team members
      const { data: memberData, error: memberError } = await supabase
        .from('team_members')
        .select('user_id, role')
        .eq('team_id', teamId);
        
      if (memberError) throw memberError;
      
      if (memberData && memberData.length > 0) {
        // Get the user details for each team member
        const userIds = memberData.map(member => member.user_id);
        
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, name, email, avatar_url')
          .in('id', userIds);
          
        if (userError) throw userError;
        
        setTeamMembers(userData || []);
      } else {
        setTeamMembers([]);
      }
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  };
  
  // Handle input changes and detect mentions
  const handleCommentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const position = e.target.selectionStart || 0;
    
    setNewComment(value);
    setCursorPosition(position);
    
    // Check if we're in a potential mention context
    if (position > 0) {
      const textBeforeCursor = value.substring(0, position);
      const matches = textBeforeCursor.match(/@(\w*)$/);
      
      if (matches) {
        setTriggeredMention(true);
        setMentionQuery(matches[1]);
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
        setTriggeredMention(false);
      }
    } else {
      setShowSuggestions(false);
      setTriggeredMention(false);
    }
  };
  
  // Handle key events for navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitComment();
    }
  };
  
  // Update cursor position on key up
  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCursorPosition(e.currentTarget.selectionStart || 0);
  };
  
  // Update cursor position on click
  const handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
    setCursorPosition(e.currentTarget.selectionStart || 0);
  };
  
  // Handle selecting a user from suggestion list
  const handleSelectUser = (user: User) => {
    if (!triggeredMention) return;
    
    const textBeforeCursor = newComment.substring(0, cursorPosition);
    const textAfterCursor = newComment.substring(cursorPosition);
    
    // Find the position of the @ symbol
    const lastAtPos = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtPos >= 0) {
      // Replace the @query with @username
      const textBeforeAt = newComment.substring(0, lastAtPos);
      const newText = `${textBeforeAt}@${user.name || user.email}${textAfterCursor}`;
      setNewComment(newText);
      
      // Move cursor position after the inserted username
      const newCursorPos = lastAtPos + 1 + (user.name || user.email).length;
      setCursorPosition(newCursorPos);
      
      // Focus the input and set selection range
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    }
    
    setShowSuggestions(false);
    setTriggeredMention(false);
  };
  
  // Submit a new comment
  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    
    try {
      // Step 1: Add the comment
      const { data: commentData, error: commentError } = await supabase
        .from('task_comments')
        .insert([
          {
            task_id: taskId,
            user_id: currentUser.id,
            content: newComment.trim()
          }
        ])
        .select();
        
      if (commentError) throw commentError;

      // Get the new comment ID
      const newCommentId = commentData?.[0]?.id;
      if (!newCommentId) throw new Error('Failed to get new comment ID');
      
      // Step 2: Extract mentions from the comment
      const mentionRegex = /@([a-zA-Z0-9._-]+)/g;
      const mentionedNames: string[] = [];
      let match;
      while ((match = mentionRegex.exec(newComment)) !== null) {
        mentionedNames.push(match[1]);
      }
      
      if (mentionedNames.length > 0) {
        // Step 3: Get task information
        const { data: taskData } = await supabase
          .from('tasks')
          .select('title, team_id, user_id')
          .eq('id', taskId)
          .single();
        
        const taskTitle = taskData?.title || 'Untitled';
        const taskTeamId = taskData?.team_id;
        
        // Step 4: Find mentioned users
        for (const mentionName of mentionedNames) {
          let mentionedUserId = null;
          
          // Special case: Check if this is a mention of the current user
          if (currentUser.name === mentionName || 
              currentUser.email === mentionName ||
              (currentUser.name && currentUser.name.includes(mentionName)) ||
              currentUser.email.includes(mentionName)) {
            
            console.log("Found self-mention with name:", mentionName);
            mentionedUserId = currentUser.id;
          } else {
            // Regular mention lookup for other users
            // Try to find by name or email (with exact match)
            let { data: userData } = await supabase
              .from('users')
              .select('id, email, name')
              .or(`name.eq.${mentionName},email.eq.${mentionName}`)
              .limit(1);
              
            // If not found with exact match, try with partial match
            if (!userData || userData.length === 0) {
              const { data: partialMatchData } = await supabase
                .from('users')
                .select('id, email, name')
                .or(`name.ilike.%${mentionName}%,email.ilike.%${mentionName}%`)
                .limit(1);
                
              userData = partialMatchData;
            }
              
            mentionedUserId = userData?.[0]?.id;
          }
          
          // Create notifications for all mentioned users (including self-mentions)
          if (mentionedUserId) {
            try {
              // Step a: Record the mention using the direct function
              const { data: mentionData, error: mentionError } = await supabase
                .rpc('record_comment_mention_direct', {
                  p_comment_id: newCommentId,
                  p_user_id: mentionedUserId
                });
                
              if (mentionError) {
                console.error('Error recording mention:', mentionError);
              }
                
              // Step b: Create a notification using the direct function
              const { data: notificationData, error: notificationError } = await supabase
                .rpc('create_mention_notification_direct', {
                  p_user_id: mentionedUserId,
                  p_content: `${currentUser.name || currentUser.email} mentioned you in a comment on task "${taskTitle}"`,
                  p_task_id: taskId,
                  p_comment_id: newCommentId,
                  p_team_id: taskTeamId,
                  p_actor_id: currentUser.id
                });
                
              if (notificationError) {
                console.error('Error creating notification:', notificationError);
              }
            } catch (error) {
              console.error('Error creating mention or notification:', error);
            }
          }
        }
        
        // Step 7: Notify task owner if not the commenter
        if (taskData?.user_id && taskData.user_id !== currentUser.id) {
          try {
            const { data: notificationData, error: notificationError } = await supabase
              .rpc('create_comment_notification_direct', {
                p_user_id: taskData.user_id,
                p_content: `${currentUser.name || currentUser.email} commented on your task "${taskTitle}"`,
                p_task_id: taskId,
                p_comment_id: newCommentId,
                p_team_id: taskTeamId,
                p_actor_id: currentUser.id
              });
              
            if (notificationError) {
              console.error('Error creating comment notification:', notificationError);
            }
          } catch (error) {
            console.error('Error creating comment notification:', error);
          }
        }
      }
      
      setNewComment("");
      fetchComments(); // Refresh comments
      
      // Scroll to the bottom after adding a comment
      setTimeout(() => {
        if (commentsContainerRef.current) {
          commentsContainerRef.current.scrollTop = commentsContainerRef.current.scrollHeight;
        }
      }, 300); // Small delay to allow comments to load
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };
  
  // Delete a comment
  const handleDeleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('task_comments')
        .delete()
        .eq('id', commentId);
        
      if (error) throw error;
      
      fetchComments(); // Refresh comments
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };
  
  // Format the content to highlight mentions
  const formatCommentContent = (content: string) => {
    return content.replace(/@([a-zA-Z0-9._-]+)/g, '<span class="text-primary font-medium">@$1</span>');
  };
  
  // Get user initials for avatar
  const getUserInitials = (name?: string, email?: string): string => {
    if (name && name.length > 0) {
      const nameParts = name.split(' ');
      if (nameParts.length >= 2) {
        return (nameParts[0][0] + nameParts[1][0]).toUpperCase();
      }
      return name[0].toUpperCase();
    }
    if (email && email.length > 0) {
      return email[0].toUpperCase();
    }
    return '?';
  };
  
  return (
    <div className="flex flex-col h-full">
      
      {/* Scrollable container with auto-scroll to latest comment */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto min-h-[150px]" id="comments-container" ref={commentsContainerRef}>
          <div className="space-y-4 p-1 pb-4">
            {isLoading ? (
              <div className="text-center text-muted-foreground">Loading comments...</div>
            ) : comments.length === 0 ? (
              <div className="text-center text-muted-foreground">No comments yet. Be the first to comment!</div>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="flex gap-3 group">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={comment.user_avatar_url || ''} alt={comment.user_name || comment.user_email || ''} />
                    <AvatarFallback>{getUserInitials(comment.user_name, comment.user_email)}</AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium">{comment.user_name || comment.user_email}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    
                    <div 
                      className="mt-1"
                      dangerouslySetInnerHTML={{ __html: formatCommentContent(comment.content) }}
                    />
                  </div>
                  
                  {(comment.user_id === currentUser.id) && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Comment</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this comment? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteComment(comment.id)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Delete comment</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
      {/* Comment form - Fixed at bottom */}
      <div className="mt-2 border-t pt-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              value={newComment}
              onChange={handleCommentChange}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
              onClick={handleInputClick}
              placeholder="Add a comment..."
              className="pr-10"
            />
            
            {showSuggestions && teamId && (
              <div className="absolute z-10 w-60 mt-1">
                <UserSuggestionList
                  users={teamMembers}
                  query={mentionQuery}
                  onSelectUser={handleSelectUser}
                />
              </div>
            )}
          </div>
          <Button 
            type="button" 
            size="icon"
            onClick={handleSubmitComment}
            disabled={!newComment.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        
        {teamId && (
          <p className="text-xs text-muted-foreground mt-1">
            Tip: Use @username to mention team members
          </p>
        )}
      </div>
    </div>
  );
} 