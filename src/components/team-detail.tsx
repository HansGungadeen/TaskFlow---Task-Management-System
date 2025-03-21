"use client";

import { useState, useEffect, useRef } from "react";
import { Team, TeamMember, TeamRole } from "@/types/teams";
import { Task, TaskStatus } from "@/types/tasks";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import Link from "next/link";
import {
  Users,
  ListTodo,
  MessageSquare,
  UserCircle,
  Clock,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Settings,
  Mail,
  X,
  ClipboardList,
  CheckCircle,
  AlertCircle,
  Pencil
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "./ui/dialog";
import { Textarea } from "./ui/textarea";
import { createClient } from "@/utils/utils";
import { Separator } from "./ui/separator";
import { format, parseISO } from "date-fns";
import { Skeleton } from "./ui/skeleton";

type TeamDetailProps = {
  team: Team;
  currentUser: any;
  teamMembers: TeamMember[];
  teamTasks: Task[];
  userRole: TeamRole;
};

// Add task history entry type
type TaskHistoryEntry = {
  id: string;
  task_id: string;
  user_id: string;
  action_type: "create" | "update" | "delete";
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  assigned_to: string | null;
  change_type: string | null;
  assignee_data?: {
    name?: string | null;
    email?: string | null;
  } | null;
  user?: {
    name: string | null;
    full_name: string | null;
    email: string | null;
  };
};

export default function TeamDetail({
  team,
  currentUser,
  teamMembers,
  teamTasks: initialTeamTasks,
  userRole,
}: TeamDetailProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [teamTasks, setTeamTasks] = useState(initialTeamTasks);
  const [taskHistory, setTaskHistory] = useState<TaskHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const supabase = createClient();
  const supabaseRef = useRef(supabase);

  const getUserInitials = (name?: string, email?: string) => {
    if (name) {
      const parts = name.split(" ");
      if (parts.length > 1) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    return "U";
  };

  const getUserNameFromId = (userId: string): string => {
    // First check if it's the current user
    if (currentUser?.id === userId) {
      return 'you';
    }
    
    // Then check if it's a team member
    const teamMember = teamMembers.find(member => member.user_id === userId);
    if (teamMember) {
      return teamMember.user_name || teamMember.user_email || 'Team Member';
    }
    
    // Last resort, show a shortened ID
    return 'User ' + userId.substring(0, 4);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "todo":
        return "bg-slate-500";
      case "in_progress":
        return "bg-blue-500";
      case "done":
        return "bg-green-500";
      default:
        return "bg-slate-500";
    }
  };

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case "low":
        return "bg-slate-400";
      case "medium":
        return "bg-blue-400";
      case "high":
        return "bg-orange-400";
      case "urgent":
        return "bg-red-500";
      default:
        return "bg-slate-400";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Format value for display
  const formatValue = (value: string | null): string | React.ReactNode => {
    if (value === null) return "None";
    if (value === "") return "Empty";

    // Check if it's a UUID (likely a user ID from assigned_to field)
    if (value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      return "User ID: " + value.substring(0, 8) + "...";
    }

    // Check if it's a JSON string
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === "object") {
        return (
          <div className="space-y-1">
            {Object.entries(parsed).map(([key, val]) => (
              <div key={key} className="text-xs">
                <span className="font-medium">{key}:</span>{" "}
                {val !== null ? String(val) : "None"}
              </div>
            ))}
          </div>
        );
      }
    } catch (e) {
      // Not JSON, continue with normal formatting
    }

    // Format date strings
    if (value && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      try {
        return format(parseISO(value), "PPp"); // Format as "Apr 29, 2023, 1:30 PM"
      } catch (e) {
        // If parsing fails, return the original value
        return value;
      }
    }

    return value;
  };

  // Get action color for badges
  const getActionColor = (action: string) => {
    switch (action) {
      case "create":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "update":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "delete":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  // Get field label for display
  const getFieldLabel = (field: string | null) => {
    if (!field) return "Unknown Field";
    
    switch (field) {
      case "title":
        return "Title";
      case "description":
        return "Description";
      case "status":
        return "Status";
      case "priority":
        return "Priority";
      case "due_date":
        return "Due Date";
      case "task":
        return "Task";
      case "assigned_to":
        return "Assigned To";
      case "change_type":
        return "Change Type";
      default:
        return field.charAt(0).toUpperCase() + field.slice(1);
    }
  };

  // Get user name from entry
  const getUserName = (entry: TaskHistoryEntry) => {
    if (!entry.user) {
      // If we couldn't fetch user info, just show the user ID
      return entry.user_id
        ? `User ${entry.user_id.substring(0, 8)}...`
        : "Unknown User";
    }
    return (
      entry.user.full_name ||
      entry.user.name ||
      entry.user.email ||
      "Unknown User"
    );
  };

  // Function to fetch task history
  const fetchTaskHistory = async (taskId: string) => {
    setHistoryLoading(true);
    try {
      console.log("Fetching task history for task:", taskId);
      
      // Fetch task history
      const { data, error } = await supabaseRef.current
        .from("task_history")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      if (data && data.length > 0) {
        // Get user IDs for entries created by users
        const userIds = data
          .map((entry) => entry.user_id)
          .filter((id, index, self) => self.indexOf(id) === index);
        
        // Get assigned user IDs - check both assigned_to and new_value fields for assignment entries
        const assigneeIds = data
          .filter(entry => 
            (entry.change_type === 'assignment' && entry.assigned_to) || 
            (entry.field_name === 'assigned_to' && entry.new_value))
          .map(entry => entry.assigned_to || entry.new_value)
          .filter((id, index, self) => 
            id && typeof id === 'string' && 
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) && 
            self.indexOf(id) === index
          ) as string[];
        
        // Fetch user data
        const { data: userData, error: userError } = await supabaseRef.current
          .from("users")
          .select("id, name, full_name, email")
          .in("id", userIds);

        // Fetch assignee data
        let assigneeData: any[] = [];
        if (assigneeIds.length > 0) {
          const { data: assignees, error: assigneeError } = await supabaseRef.current
            .from("users")
            .select("id, name, full_name, email")
            .in("id", assigneeIds);
          
          if (!assigneeError && assignees) {
            assigneeData = assignees;
          }
        }

        if (!userError && userData) {
          // Add user information to each history entry
          data.forEach((entry) => {
            // Set user who made the change
            entry.user = userData.find((user) => user.id === entry.user_id) || null;
            
            // For assignment entries, set assignee data
            if (entry.change_type === 'assignment' && entry.assigned_to) {
              const assignee = assigneeData.find(user => user.id === entry.assigned_to);
              if (assignee) {
                entry.assignee_data = {
                  name: assignee.full_name || assignee.name,
                  email: assignee.email
                };
              }
            } 
            // Also handle regular field updates to assigned_to
            else if (entry.field_name === 'assigned_to' && entry.new_value) {
              const assignee = assigneeData.find(user => user.id === entry.new_value);
              if (assignee) {
                entry.assignee_data = {
                  name: assignee.full_name || assignee.name,
                  email: assignee.email
                };
              }
            }
          });
        }
      }

      console.log("Task history data received:", data);
      setTaskHistory(data || []);
    } catch (error) {
      console.error("Error fetching task history:", error);
      setTaskHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Function to handle opening task details
  const handleViewTask = async (task: Task) => {
    let taskWithAssignee = { ...task };
    
    // If task is assigned but missing assignee data, fetch it
    if (task.assigned_to && !task.assignee_data) {
      console.log("Fetching user data for task assigned to:", task.assigned_to);
      try {
        // Since profile tables don't exist, get user data from local state if available
        const teamMember = teamMembers.find(member => member.user_id === task.assigned_to);
        
        if (teamMember) {
          console.log("Found user in team members:", teamMember);
          taskWithAssignee.assignee_data = {
            id: teamMember.user_id,
            email: teamMember.user_email || '',
            name: teamMember.user_name || teamMember.user_email || 'Team Member',
            avatar_url: teamMember.user_avatar_url || undefined
          };
        } else {
          // Try to get the current user as fallback if they are the assignee
          const { data: authUser } = await supabase.auth.getUser();
          
          if (authUser?.user && authUser.user.id === task.assigned_to) {
            console.log("Current user is the assignee:", authUser.user);
            taskWithAssignee.assignee_data = {
              id: authUser.user.id,
              email: authUser.user.email || '',
              name: authUser.user.user_metadata?.full_name || 
                    authUser.user.user_metadata?.name || 
                    authUser.user.email || 'Current User',
              avatar_url: authUser.user.user_metadata?.avatar_url || undefined
            };
          } else {
            // If we can't find the user, just use the ID as a fallback
            taskWithAssignee.assignee_data = {
              id: task.assigned_to,
              email: '',
              name: 'User ' + task.assigned_to.substring(0, 8),
              avatar_url: undefined
            };
          }
        }
      } catch (error) {
        console.error('Error fetching assignee data:', error);
        // Provide a fallback assignee data
        taskWithAssignee.assignee_data = {
          id: task.assigned_to,
          email: '',
          name: 'User ' + task.assigned_to.substring(0, 8),
          avatar_url: undefined
        };
      }
    }
    
    // Fetch task history when opening the task
    fetchTaskHistory(task.id);
    
    setSelectedTask(taskWithAssignee);
    setIsTaskModalOpen(true);
  };

  const updateTaskStatus = async (taskId: string, status: 'todo' | 'in_progress' | 'done') => {
    try {
      // Get the current task
      const currentTask = selectedTask;
      if (!currentTask || currentTask.status === status) return;
      
      console.log("Updating task status:", { taskId, status, currentStatus: currentTask.status });
      
      // Create status update record
      const now = new Date().toISOString();
      
      // Update task in the database - only update the status field
      const { data, error } = await supabase
        .from('tasks')
        .update({ 
          status, 
          updated_at: now
        })
        .eq('id', taskId)
        .select();
        
      if (error) {
        console.error("Error updating task status in database:", error);
        throw error;
      }
      
      console.log("Database response:", data);
      
      // Create a new status update for our local state only
      let statusUpdates = [...(currentTask.status_updates || [])];
      statusUpdates.push({
        status: status,
        updated_at: now,
        user_id: currentUser?.id
      });
      
      // Update the task in the local state
      if (selectedTask && selectedTask.id === taskId) {
        setSelectedTask({ 
          ...selectedTask, 
          status,
          updated_at: now,
          status_updates: statusUpdates // Only stored locally, not in DB
        });
      }
      
      // Update the task in the teamTasks state
      setTeamTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === taskId 
            ? { ...task, status, updated_at: now } 
            : task
        )
      );
      
      console.log("Task status updated successfully");
      
    } catch (error) {
      console.error('Error updating task status:', error);
      alert("Failed to update task status. Please try again.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Team Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Link href={`/teams/${team.id}/inbox`}>
          <Button variant="outline" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <span>Team Inbox</span>
          </Button>
        </Link>

        <Button
          variant="outline"
          className="flex items-center gap-2"
          onClick={() => router.push("/dashboard")}
        >
          <ListTodo className="h-4 w-4" />
          <span>Manage Tasks</span>
        </Button>

        {userRole === "admin" && (
          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={() => router.push("/teams")}
          >
            <Settings className="h-4 w-4" />
            <span>Team Settings</span>
          </Button>
        )}
      </div>

      <Tabs defaultValue="overview" onValueChange={setActiveTab}>
        <TabsList className="grid w-full md:w-auto grid-cols-3">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>Overview</span>
          </TabsTrigger>
          <TabsTrigger value="members" className="flex items-center gap-2">
            <UserCircle className="h-4 w-4" />
            <span>Members</span>
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-2">
            <ListTodo className="h-4 w-4" />
            <span>Tasks</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Team Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Name
                    </div>
                    <div>{team.name}</div>
                  </div>
                  {team.description && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">
                        Description
                      </div>
                      <div className="whitespace-pre-wrap">{team.description}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Created
                    </div>
                    <div>{formatDate(team.created_at)}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Your Role
                    </div>
                    <div className="capitalize">{userRole}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Team Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <div className="text-3xl font-bold">{teamMembers.length}</div>
                    <div className="text-sm text-muted-foreground">Members</div>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <div className="text-3xl font-bold">{teamTasks.length}</div>
                    <div className="text-sm text-muted-foreground">Tasks</div>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <div className="text-3xl font-bold">
                      {teamTasks.filter((task) => task.status === "done").length}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Completed Tasks
                    </div>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <div className="text-3xl font-bold">
                      {teamTasks.filter((task) => task.status === "in_progress").length}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      In Progress
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="members" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Team Members</CardTitle>
              <CardDescription>
                {teamMembers.length} members in this team
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {teamMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={member.user_avatar_url || ""} />
                        <AvatarFallback>
                          {getUserInitials(member.user_name, member.user_email)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">
                          {member.user_name || member.user_email}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {member.user_name ? member.user_email : ""}
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant={
                        member.role === "admin"
                          ? "default"
                          : member.role === "member"
                          ? "outline"
                          : "secondary"
                      }
                    >
                      {member.role}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Team Tasks</CardTitle>
              <CardDescription>
                {teamTasks.length} tasks assigned to this team
              </CardDescription>
            </CardHeader>
            <CardContent>
              {teamTasks.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <ListTodo className="h-10 w-10 mx-auto mb-2" />
                  <p>No tasks assigned to this team yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {teamTasks
                    .slice(0, 5)
                    .map((task) => (
                      <div
                        key={task.id}
                        className="p-3 border rounded-md hover:bg-muted/30 cursor-pointer"
                        onClick={() => handleViewTask(task)}
                      >
                        <div className="flex justify-between items-center">
                          <div className="font-medium">{task.title}</div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <Badge
                            variant="outline"
                            className={`flex items-center gap-1 ${getStatusColor(
                              task.status
                            )} text-white`}
                          >
                            {task.status === "todo" && <ListTodo className="h-3 w-3" />}
                            {task.status === "in_progress" && <Clock className="h-3 w-3" />}
                            {task.status === "done" && <CheckCircle2 className="h-3 w-3" />}
                            <span>
                              {task.status === "todo"
                                ? "To Do"
                                : task.status === "in_progress"
                                ? "In Progress"
                                : "Done"}
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

                          {task.due_date && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDate(task.due_date)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                  {teamTasks.length > 5 && (
                    <Button
                      variant="outline"
                      className="w-full mt-2"
                      onClick={() => router.push("/dashboard")}
                    >
                      View All Tasks
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Task Detail Modal */}
      <Dialog 
        open={isTaskModalOpen}
        onOpenChange={(open) => {
          setIsTaskModalOpen(open);
          if (!open) setSelectedTask(null);
        }}
      >
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          {selectedTask && (
            <>
              <DialogHeader>
                <div className="flex justify-between items-start">
                  <DialogTitle className="text-xl">{selectedTask.title}</DialogTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="rounded-full h-6 w-6 p-0 flex items-center justify-center"
                    onClick={() => setIsTaskModalOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                {/* Task Status Badges */}
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant="outline"
                    className={`${getStatusColor(selectedTask.status)} text-white`}
                  >
                    {selectedTask.status === "todo" && <ListTodo className="h-3 w-3 mr-1" />}
                    {selectedTask.status === "in_progress" && <Clock className="h-3 w-3 mr-1" />}
                    {selectedTask.status === "done" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                    <span>
                      {selectedTask.status === "todo"
                        ? "To Do"
                        : selectedTask.status === "in_progress"
                        ? "In Progress"
                        : "Done"}
                    </span>
                  </Badge>

                  {selectedTask.priority && (
                    <Badge
                      variant="outline"
                      className={`${getPriorityColor(selectedTask.priority)} text-white`}
                    >
                      {selectedTask.priority}
                    </Badge>
                  )}

                  {selectedTask.due_date && (
                    <Badge variant="outline">
                      <Calendar className="h-3 w-3 mr-1" />
                      <span>{formatDate(selectedTask.due_date)}</span>
                    </Badge>
                  )}
                </div>

                {/* Task Metadata */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Created:</span>{" "}
                    {formatDate(selectedTask.created_at)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">ID:</span>{" "}
                    <code className="bg-muted px-1 py-0.5 rounded text-xs">
                      {selectedTask.id.substring(0, 8)}
                    </code>
                  </div>
                </div>

                {/* Task Description */}
                {selectedTask.description && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Description</h3>
                    <div className="bg-muted/30 p-3 rounded-md text-sm whitespace-pre-wrap">
                      {selectedTask.description}
                    </div>
                  </div>
                )}

                {/* Team Information */}
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Task Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span className="text-sm">Team: {team.name}</span>
                      </div>
                    </div>
                    
                    <div>
                      {selectedTask.assigned_to ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={selectedTask.assignee_data?.avatar_url || ''} />
                            <AvatarFallback>
                              {getUserInitials(
                                selectedTask.assignee_data?.name, 
                                selectedTask.assignee_data?.email
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">
                            Assigned to: {
                              selectedTask.assignee_data?.name || 
                              selectedTask.assignee_data?.email || 
                              (selectedTask.assigned_to ? 'User: ' + selectedTask.assigned_to.substring(0, 8) : 'Unknown User')
                            }
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <UserCircle className="h-4 w-4" />
                          <span className="text-sm">Unassigned</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Subtasks Information with Progress Bar */}
                {selectedTask.subtasks_count != null && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Subtasks</h3>
                    <div className="flex flex-col gap-2">
                      <div className="text-sm">
                        <ClipboardList className="h-4 w-4 inline mr-1" />
                        <span>
                          {selectedTask.completed_subtasks_count || 0} of {selectedTask.subtasks_count} complete
                        </span>
                      </div>
                      {selectedTask.subtasks_count > 0 && (
                        <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-green-500 h-full rounded-full"
                            style={{ 
                              width: `${(selectedTask.completed_subtasks_count || 0) / selectedTask.subtasks_count * 100}%`
                            }}
                          ></div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Dependencies Information */}
                {selectedTask.has_dependencies && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Dependencies</h3>
                    <div className="text-sm flex items-center gap-1">
                      {selectedTask.dependencies_completed ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span>All dependencies completed</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                          <span>Has incomplete dependencies</span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Quick Task Actions */}
                <Separator className="my-4" />

                {/* Quick Actions */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-3">
                    <h3 className="text-sm font-medium">Update Status</h3>
                    <div className="flex flex-col gap-2">
                      <Button 
                        size="sm" 
                        variant={selectedTask.status === 'todo' ? 'default' : 'outline'}
                        className="justify-start"
                        onClick={() => updateTaskStatus(selectedTask.id, 'todo')}
                      >
                        <ListTodo className="h-4 w-4 mr-2" />
                        To Do
                      </Button>
                      <Button 
                        size="sm" 
                        variant={selectedTask.status === 'in_progress' ? 'default' : 'outline'}
                        className="justify-start"
                        onClick={() => updateTaskStatus(selectedTask.id, 'in_progress')}
                      >
                        <Clock className="h-4 w-4 mr-2" />
                        In Progress
                      </Button>
                      <Button 
                        size="sm" 
                        variant={selectedTask.status === 'done' ? 'default' : 'outline'}
                        className="justify-start"
                        onClick={() => updateTaskStatus(selectedTask.id, 'done')}
                        disabled={selectedTask.has_dependencies && !selectedTask.dependencies_completed}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Done
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <h3 className="text-sm font-medium">Task Actions</h3>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="justify-start"
                        onClick={() => router.push(`/dashboard?task=${selectedTask.id}`)}
                      >
                        <ListTodo className="h-4 w-4 mr-2" />
                        View in Dashboard
                      </Button>
                      
                      {userRole !== 'viewer' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="justify-start"
                          onClick={() => router.push(`/dashboard?edit=${selectedTask.id}`)}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit Task
                        </Button>
                      )}
                      
                      <Link href={`/teams/${team.id}/inbox?task=${selectedTask.id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="justify-start w-full"
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Discuss in Inbox
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Activity Timeline */}
                <div className="mt-6">
                  <h3 className="text-sm font-medium mb-2">Activity Timeline</h3>
                  
                  {historyLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : taskHistory.length === 0 ? (
                    <div className="text-center text-muted-foreground py-4 border rounded-md">
                      No history records found for this task.
                    </div>
                  ) : (
                    <div className="space-y-3 pl-4 border-l">
                      {taskHistory.map((entry) => {
                        // Check if this is the task creation entry
                        if (entry.action_type === 'create' && !entry.field_name) {
                          return (
                            <div key={entry.id} className="relative">
                              <div className="absolute -left-6 mt-1 w-2 h-2 rounded-full bg-green-500"></div>
                              <div className="text-xs text-muted-foreground mb-1">
                                {format(new Date(entry.created_at), "MMM d, yyyy h:mm a")}
                              </div>
                              <div className="text-sm flex items-center gap-1">
                                <span>Task created</span>
                                <span className="text-xs text-muted-foreground">
                                  by {getUserName(entry)}
                                </span>
                              </div>
                            </div>
                          );
                        }
                        
                        // Special handling for status changes
                        if (entry.field_name === 'status') {
                          return (
                            <div key={entry.id} className="relative">
                              <div className={`absolute -left-6 mt-1 w-2 h-2 rounded-full ${
                                entry.new_value === 'done' ? 'bg-green-500' : 
                                entry.new_value === 'in_progress' ? 'bg-blue-500' : 
                                'bg-slate-500'
                              }`}></div>
                              <div className="text-xs text-muted-foreground mb-1">
                                {format(new Date(entry.created_at), "MMM d, yyyy h:mm a")}
                              </div>
                              <div className="text-sm">
                                <div className="flex items-center gap-1">
                                  <span>Status changed to </span>
                                  <Badge variant="outline" className={`${getStatusColor(entry.new_value || '')} text-white py-0 px-1.5 text-xs`}>
                                    {entry.new_value === "todo" ? "To Do" : 
                                     entry.new_value === "in_progress" ? "In Progress" : "Done"}
                                  </Badge>
                                  
                                  <span className="text-xs text-muted-foreground">
                                    by {getUserName(entry)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        
                        // Assignment changes
                        if (entry.change_type === 'assignment' || entry.field_name === 'assigned_to') {
                          let assigneeName = "a user";
                          
                          if (entry.assignee_data && entry.assignee_data.name) {
                            assigneeName = entry.assignee_data.name;
                          } else if (entry.assignee_data && entry.assignee_data.email) {
                            assigneeName = entry.assignee_data.email;
                          } else if (entry.assigned_to || entry.new_value) {
                            const userId = entry.assigned_to || entry.new_value;
                            if (typeof userId === 'string') {
                              assigneeName = getUserNameFromId(userId);
                            }
                          }
                          
                          return (
                            <div key={entry.id} className="relative">
                              <div className="absolute -left-6 mt-1 w-2 h-2 rounded-full bg-purple-500"></div>
                              <div className="text-xs text-muted-foreground mb-1">
                                {format(new Date(entry.created_at), "MMM d, yyyy h:mm a")}
                              </div>
                              <div className="text-sm flex items-center gap-1">
                                <span>
                                  {(entry.assigned_to || entry.new_value) 
                                    ? `Task assigned to ${assigneeName}`
                                    : "Task unassigned"}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  by {getUserName(entry)}
                                </span>
                              </div>
                            </div>
                          );
                        }
                        
                        // Other field changes
                        if (entry.action_type === 'update' && entry.field_name) {
                          return (
                            <div key={entry.id} className="relative">
                              <div className="absolute -left-6 mt-1 w-2 h-2 rounded-full bg-blue-500"></div>
                              <div className="text-xs text-muted-foreground mb-1">
                                {format(new Date(entry.created_at), "MMM d, yyyy h:mm a")}
                              </div>
                              <div className="text-sm">
                                <span className="font-medium">{getFieldLabel(entry.field_name)}</span>{" "}
                                changed from{" "}
                                <span className="px-1 py-0.5 bg-red-100 dark:bg-red-900 rounded text-xs">
                                  {formatValue(entry.old_value)}
                                </span>{" "}
                                to{" "}
                                <span className="px-1 py-0.5 bg-green-100 dark:bg-green-900 rounded text-xs">
                                  {formatValue(entry.new_value)}
                                </span>
                                <span className="text-xs text-muted-foreground ml-1">
                                  by {getUserName(entry)}
                                </span>
                              </div>
                            </div>
                          );
                        }
                        
                        // Default for any other types
                        return (
                          <div key={entry.id} className="relative">
                            <div className="absolute -left-6 mt-1 w-2 h-2 rounded-full bg-gray-500"></div>
                            <div className="text-xs text-muted-foreground mb-1">
                              {format(new Date(entry.created_at), "MMM d, yyyy h:mm a")}
                            </div>
                            <div className="text-sm">
                              <Badge className={getActionColor(entry.action_type)}>
                                {entry.action_type}
                              </Badge>{" "}
                              <span>{entry.field_name || "task"}</span>
                              <span className="text-xs text-muted-foreground ml-1">
                                by {getUserName(entry)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
} 