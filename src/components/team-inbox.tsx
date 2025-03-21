"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/utils";
import { TeamMember, TeamRole } from "@/types/teams";
import { Task } from "@/types/tasks";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
  MessageSquare,
  ListTodo,
  UserCircle,
  PlusCircle,
  Link as LinkIcon,
  AlertTriangle,
  Clock,
  Calendar,
  CheckCircle2,
  UserCog,
  ChevronRight,
  RefreshCcw,
  SendHorizonal,
  Send,
  MailQuestion,
  Pin,
  PinOff,
  Reply,
  Trash,
  FileText,
  Pencil,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

// Define types for the inbox messages
export interface InboxMessage {
  id: string;
  team_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string | null;
  is_pinned: boolean;
  has_attachment: boolean;
  attachment_url?: string | null;
  attachment_name?: string | null;
  related_task_id?: string | null;
  // Joined fields
  user_name?: string;
  user_email?: string;
  user_avatar_url?: string;
  related_task?: Task | null;
}

type TeamInboxProps = {
  teamId: string;
  teamName: string;
  currentUser: any;
  teamMembers: TeamMember[];
  userRole: TeamRole;
  initialMessages?: InboxMessage[];
  initialTasks?: Task[];
};

export default function TeamInbox({ 
  teamId, 
  teamName, 
  currentUser, 
  teamMembers,
  userRole,
  initialMessages = [],
  initialTasks = []
}: TeamInboxProps) {
  const router = useRouter();
  const supabase = createClient();
  
  const [messages, setMessages] = useState<InboxMessage[]>(initialMessages);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(initialMessages.length === 0);
  const [activeTab, setActiveTab] = useState("messages");
  const [teamTasks, setTeamTasks] = useState<Task[]>(initialTasks);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  
  // Check if user has permission to create messages
  const canCreateMessage = userRole === "admin" || userRole === "member";
  
  // Initialize the page data
  useEffect(() => {
    loadInboxMessages();
    loadTeamTasks();
    
    // Set up real-time subscription for new messages
    const messagesSubscription = supabase
      .channel('team_inbox_messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_inbox_messages',
          filter: `team_id=eq.${teamId}`
        },
        () => {
          loadInboxMessages();
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(messagesSubscription);
    };
  }, [teamId]);
  
  const loadInboxMessages = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .rpc('get_team_inbox_messages', { team_id_param: teamId });
        
      if (error) throw error;
      
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading inbox messages:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const loadTeamTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      setTeamTasks(data || []);
    } catch (error) {
      console.error('Error loading team tasks:', error);
    }
  };
  
  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    
    try {
      const { data, error } = await supabase
        .from('team_inbox_messages')
        .insert([
          {
            team_id: teamId,
            user_id: currentUser.id,
            content: newMessage.trim(),
            related_task_id: selectedTaskId,
          },
        ]);
        
      if (error) throw error;
      
      setNewMessage("");
      setSelectedTaskId(null);
      await loadInboxMessages();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };
  
  const handlePinMessage = async (messageId: string, isPinned: boolean) => {
    try {
      const { error } = await supabase
        .from('team_inbox_messages')
        .update({ is_pinned: !isPinned })
        .eq('id', messageId);
        
      if (error) throw error;
      
      // Update local state
      setMessages(
        messages.map(msg => 
          msg.id === messageId 
            ? { ...msg, is_pinned: !isPinned }
            : msg
        )
      );
    } catch (error) {
      console.error('Error pinning/unpinning message:', error);
    }
  };
  
  const handleDeleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('team_inbox_messages')
        .delete()
        .eq('id', messageId);
        
      if (error) throw error;
      
      // Update local state
      setMessages(messages.filter(msg => msg.id !== messageId));
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };
  
  const handleReply = (messageId: string) => {
    const message = messages.find(msg => msg.id === messageId);
    if (!message) return;
    
    setReplyingTo(messageId);
    setNewMessage(`@${message.user_name || message.user_email}: `);
  };

  const formatMessageDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  };
  
  const getUserInitials = (name?: string, email?: string) => {
    if (name) {
      const parts = name.split(' ');
      if (parts.length > 1) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'todo': return 'bg-slate-500';
      case 'in_progress': return 'bg-blue-500';
      case 'done': return 'bg-green-500';
      default: return 'bg-slate-500';
    }
  };
  
  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'low': return 'bg-slate-400';
      case 'medium': return 'bg-blue-400';
      case 'high': return 'bg-orange-400';
      case 'urgent': return 'bg-red-500';
      default: return 'bg-slate-400';
    }
  };
  
  return (
    <div className="flex flex-col gap-6">
      <Tabs defaultValue="messages" onValueChange={setActiveTab}>
        <TabsList className="grid w-full md:w-auto grid-cols-2">
          <TabsTrigger value="messages" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span>Messages</span>
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-2">
            <ListTodo className="h-4 w-4" />
            <span>Team Tasks</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="messages" className="mt-4">
          <div className="flex flex-col space-y-6">
            {/* Message composition area */}
            {canCreateMessage && (
              <div className="flex flex-col gap-2 bg-muted/30 p-4 rounded-lg shadow-sm">
                <div className="flex items-start gap-3">
                  <Avatar>
                    <AvatarImage src={currentUser.user_metadata?.avatar_url} />
                    <AvatarFallback>
                      {getUserInitials(
                        currentUser.user_metadata?.name, 
                        currentUser.email
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <Textarea
                      placeholder="Type a message to the team..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      className="min-h-24 resize-none"
                    />
                  </div>
                </div>
                
                <div className="flex justify-between items-center mt-2">
                  <div className="flex items-center gap-2">
                    {selectedTaskId && (
                      <div className="flex items-center gap-2 bg-secondary px-2 py-1 rounded text-xs">
                        <LinkIcon className="h-3 w-3" />
                        <span>Task linked</span>
                        <button 
                          onClick={() => setSelectedTaskId(null)}
                          className="hover:text-destructive"
                        >
                          <Trash className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {!selectedTaskId && teamTasks.length > 0 && (
                      <Select onValueChange={(value) => setSelectedTaskId(value)}>
                        <SelectTrigger className="w-[200px] h-8 text-xs">
                          <SelectValue placeholder="Link to task" />
                        </SelectTrigger>
                        <SelectContent>
                          {teamTasks.map((task) => (
                            <SelectItem key={task.id} value={task.id} className="text-xs">
                              {task.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    
                    <Button 
                      size="sm" 
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim()}
                      className="h-8"
                    >
                      <Send className="h-3 w-3 mr-1" />
                      Send
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Messages display area */}
            <div className="space-y-4">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="flex items-center gap-2">
                    <RefreshCcw className="h-4 w-4 animate-spin" />
                    <span>Loading messages...</span>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 bg-muted/30 rounded-lg">
                  <MailQuestion className="h-12 w-12 text-muted-foreground mb-2" />
                  <h3 className="text-lg font-medium">No messages yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Start a conversation with your team
                  </p>
                </div>
              ) : (
                <>
                  {/* Pinned messages section */}
                  {messages.some(msg => msg.is_pinned) && (
                    <div className="mb-6">
                      <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <Pin className="h-3 w-3" />
                        <span>Pinned Messages</span>
                      </h3>
                      <div className="space-y-4">
                        {messages
                          .filter(msg => msg.is_pinned)
                          .map(message => (
                            <Card key={message.id} className="relative border-l-4 border-l-brand-500">
                              <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-8 w-8">
                                      <AvatarImage src={message.user_avatar_url || ''} />
                                      <AvatarFallback>
                                        {getUserInitials(message.user_name, message.user_email)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <div className="font-medium text-sm">
                                        {message.user_name || message.user_email}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {formatMessageDate(message.created_at)}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-1">
                                    {userRole === 'admin' && (
                                      <button 
                                        onClick={() => handlePinMessage(message.id, message.is_pinned)}
                                        className="text-muted-foreground hover:text-foreground"
                                      >
                                        <PinOff className="h-4 w-4" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent className="pb-2">
                                <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                                
                                {message.related_task && (
                                  <div className="mt-2 p-2 bg-muted rounded-md text-xs flex items-start gap-2">
                                    <LinkIcon className="h-3 w-3 mt-0.5" />
                                    <div>
                                      <div className="font-medium">{message.related_task.title}</div>
                                      <div className="flex items-center gap-2 mt-1">
                                        <Badge 
                                          variant="outline"
                                          className={`text-[10px] flex items-center gap-1 ${getStatusColor(message.related_task.status)} text-white`}
                                        >
                                          {message.related_task.status === 'todo' && <ListTodo className="h-2 w-2" />}
                                          {message.related_task.status === 'in_progress' && <Clock className="h-2 w-2" />}
                                          {message.related_task.status === 'done' && <CheckCircle2 className="h-2 w-2" />}
                                          <span>
                                            {message.related_task.status === 'todo' ? 'To Do' : 
                                             message.related_task.status === 'in_progress' ? 'In Progress' : 'Done'}
                                          </span>
                                        </Badge>
                                        
                                        {message.related_task.priority && (
                                          <Badge 
                                            variant="outline"
                                            className={`text-[10px] ${getPriorityColor(message.related_task.priority)} text-white`}
                                          >
                                            {message.related_task.priority}
                                          </Badge>
                                        )}
                                        
                                        {message.related_task.due_date && (
                                          <Badge 
                                            variant="outline"
                                            className="text-[10px] bg-slate-500 text-white flex items-center gap-1"
                                          >
                                            <Calendar className="h-2 w-2" />
                                            <span>
                                              {new Date(message.related_task.due_date).toLocaleDateString()}
                                            </span>
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Regular messages section */}
                  <div className="space-y-4">
                    {messages
                      .filter(msg => !msg.is_pinned)
                      .map(message => (
                        <Card key={message.id} className="shadow-sm hover:shadow transition-shadow">
                          <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={message.user_avatar_url || ''} />
                                  <AvatarFallback>
                                    {getUserInitials(message.user_name, message.user_email)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium text-sm">
                                    {message.user_name || message.user_email}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {formatMessageDate(message.created_at)}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-1">
                                {userRole === 'admin' && (
                                  <>
                                    <button 
                                      onClick={() => handlePinMessage(message.id, message.is_pinned)}
                                      className="text-muted-foreground hover:text-foreground"
                                    >
                                      <Pin className="h-4 w-4" />
                                    </button>
                                    
                                    <button 
                                      onClick={() => handleDeleteMessage(message.id)}
                                      className="text-muted-foreground hover:text-destructive"
                                    >
                                      <Trash className="h-4 w-4" />
                                    </button>
                                  </>
                                )}
                                
                                {message.user_id !== currentUser.id && canCreateMessage && (
                                  <button 
                                    onClick={() => handleReply(message.id)}
                                    className="text-muted-foreground hover:text-foreground"
                                  >
                                    <Reply className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="pb-2">
                            <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                            
                            {message.related_task && (
                              <div className="mt-2 p-2 bg-muted rounded-md text-xs flex items-start gap-2">
                                <LinkIcon className="h-3 w-3 mt-0.5" />
                                <div>
                                  <div className="font-medium">{message.related_task.title}</div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge 
                                      variant="outline"
                                      className={`text-[10px] flex items-center gap-1 ${getStatusColor(message.related_task.status)} text-white`}
                                    >
                                      {message.related_task.status === 'todo' && <ListTodo className="h-2 w-2" />}
                                      {message.related_task.status === 'in_progress' && <Clock className="h-2 w-2" />}
                                      {message.related_task.status === 'done' && <CheckCircle2 className="h-2 w-2" />}
                                      <span>
                                        {message.related_task.status === 'todo' ? 'To Do' : 
                                         message.related_task.status === 'in_progress' ? 'In Progress' : 'Done'}
                                      </span>
                                    </Badge>
                                    
                                    {message.related_task.priority && (
                                      <Badge 
                                        variant="outline"
                                        className={`text-[10px] ${getPriorityColor(message.related_task.priority)} text-white`}
                                      >
                                        {message.related_task.priority}
                                      </Badge>
                                    )}
                                    
                                    {message.related_task.due_date && (
                                      <Badge 
                                        variant="outline"
                                        className="text-[10px] bg-slate-500 text-white flex items-center gap-1"
                                      >
                                        <Calendar className="h-2 w-2" />
                                        <span>
                                          {new Date(message.related_task.due_date).toLocaleDateString()}
                                        </span>
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="tasks" className="mt-4">
          <div className="flex flex-col space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Team Tasks</h3>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => router.push('/dashboard')}
              >
                <Pencil className="h-3 w-3 mr-1" />
                Manage Tasks
              </Button>
            </div>
            
            {teamTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 bg-muted/30 rounded-lg">
                <ListTodo className="h-12 w-12 text-muted-foreground mb-2" />
                <h3 className="text-lg font-medium">No team tasks yet</h3>
                <p className="text-sm text-muted-foreground">
                  Create tasks and assign them to this team
                </p>
                <Button 
                  className="mt-4"
                  variant="default"
                  onClick={() => router.push('/dashboard')}
                >
                  Go to Dashboard
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {teamTasks.map(task => (
                  <Card 
                    key={task.id} 
                    className="shadow-sm hover:shadow transition-shadow"
                    onClick={() => router.push(`/dashboard?task=${task.id}`)}
                  >
                    <CardHeader className="p-4 pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-base">{task.title}</CardTitle>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline"
                            className={`flex items-center gap-1 ${getStatusColor(task.status)} text-white`}
                          >
                            {task.status === 'todo' && <ListTodo className="h-3 w-3" />}
                            {task.status === 'in_progress' && <Clock className="h-3 w-3" />}
                            {task.status === 'done' && <CheckCircle2 className="h-3 w-3" />}
                            <span>
                              {task.status === 'todo' ? 'To Do' : 
                               task.status === 'in_progress' ? 'In Progress' : 'Done'}
                            </span>
                          </Badge>
                          
                          {task.priority && (
                            <Badge 
                              variant="outline"
                              className={`${getPriorityColor(task.priority)} text-white`}
                            >
                              {task.priority}
                            </Badge>
                          )}
                        </div>
                        
                        {task.due_date && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{new Date(task.due_date).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                      
                      {task.assigned_to && task.assignee_data && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                          <UserCircle className="h-3 w-3" />
                          <span>Assigned to: {task.assignee_data.name || task.assignee_data.email}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 