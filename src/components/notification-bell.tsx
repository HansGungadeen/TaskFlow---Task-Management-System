"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/utils";
import { Bell } from "lucide-react";
import { Button } from "./ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "./ui/badge";
import { Notification } from "@/types/notifications";
import { useRouter } from "next/navigation";

export function NotificationBell({ userId }: { userId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  
  // Fetch notifications on component mount
  useEffect(() => {
    fetchNotifications();
    
    // Set up real-time subscription for new notifications
    const notificationsSubscription = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(notificationsSubscription);
    };
  }, [userId]);
  
  // Function to fetch user's notifications
  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
        
      if (error) throw error;

      // Get additional data for each notification
      const enhancedNotifications = await Promise.all(
        data.map(async (notification) => {
          let actorData = null;
          let taskData = null;
          let teamData = null;

          // Fetch actor data if available
          if (notification.actor_id) {
            const { data: userData } = await supabase
              .from('users')
              .select('id, name, email, avatar_url')
              .eq('id', notification.actor_id)
              .single();
            actorData = userData;
          }

          // Fetch task data if available
          if (notification.related_task_id) {
            const { data: taskInfo } = await supabase
              .from('tasks')
              .select('id, title')
              .eq('id', notification.related_task_id)
              .single();
            taskData = taskInfo;
          }

          // Fetch team data if available
          if (notification.related_team_id) {
            const { data: teamInfo } = await supabase
              .from('teams')
              .select('id, name')
              .eq('id', notification.related_team_id)
              .single();
            teamData = teamInfo;
          }

          return {
            ...notification,
            actor_name: actorData?.name,
            actor_email: actorData?.email,
            actor_avatar_url: actorData?.avatar_url,
            task_title: taskData?.title,
            team_name: teamData?.name
          };
        })
      );
      
      setNotifications(enhancedNotifications);
      
      // Set unread count
      const unread = enhancedNotifications.filter(n => !n.is_read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };
  
  // Mark a notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
        
      if (error) throw error;
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, is_read: true } 
            : n
        )
      );
      
      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };
  
  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications
        .filter(n => !n.is_read)
        .map(n => n.id);
        
      if (unreadIds.length === 0) return;
      
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', unreadIds);
        
      if (error) throw error;
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true }))
      );
      
      // Reset unread count
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };
  
  // Handle notification click
  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read first
    await markAsRead(notification.id);
    
    // Navigate based on notification type
    if (notification.related_task_id) {
      // Navigate to task
      router.push(`/dashboard?taskId=${notification.related_task_id}`);
    } else if (notification.related_team_id) {
      // Navigate to team
      router.push(`/teams/${notification.related_team_id}`);
    }
    
    // Close popover
    setIsOpen(false);
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
  
  // Get notification icon based on type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'mention':
        return 'text-blue-500';
      case 'comment':
        return 'text-green-500';
      case 'task_assignment':
        return 'text-purple-500';
      case 'task_update':
        return 'text-amber-500';
      default:
        return 'text-gray-500';
    }
  };
  
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 -mr-1 -mt-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <Card className="border-0">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">Notifications</CardTitle>
              {unreadCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs h-7"
                  onClick={markAllAsRead}
                >
                  Mark all as read
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0 max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground">
                No notifications
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification) => (
                  <div 
                    key={notification.id}
                    className={`p-3 hover:bg-secondary/50 cursor-pointer ${!notification.is_read ? 'bg-secondary/20' : ''}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex gap-3">
                      {notification.actor_id && (
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={notification.actor_avatar_url || ''} />
                          <AvatarFallback>
                            {getUserInitials(notification.actor_name, notification.actor_email)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className="flex-1 space-y-1">
                        <p className="text-sm">
                          <span dangerouslySetInnerHTML={{ __html: notification.content }} />
                        </p>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </span>
                          <Badge variant="outline" className={`text-xs ${getNotificationIcon(notification.type)}`}>
                            {notification.type.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
} 