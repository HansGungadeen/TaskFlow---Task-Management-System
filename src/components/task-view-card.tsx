"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/utils";
import { Task, Subtask, TimeEntry, TaskAttachment } from "@/types/tasks";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import {
  CheckCircle,
  Clock,
  ListTodo,
  Bell,
  Calendar,
  Link,
  AlertTriangle,
  Users,
  UserCircle,
  Pencil,
  Save,
  Trash,
  Trash2,
  Edit,
  Plus,
  TimerOff,
  Timer,
  BarChart3,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import TaskDependencySelector from "./task-dependency-selector";
import { Checkbox } from "./ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import TaskComments from "./task-comments";
import TimeTracking from "./time-tracking";
import { TaskAttachments } from "./TaskAttachments";
import TeamSelector from "./team-selector";
import UserAssignmentSelector from "./user-assignment-selector";

type TaskViewCardProps = {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onSubtasksChange?: () => void;
};

export default function TaskViewCard({
  task,
  isOpen,
  onClose,
  onSubtasksChange,
}: TaskViewCardProps) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [showDependencies, setShowDependencies] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [editingDueDate, setEditingDueDate] = useState(false);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [newSubtask, setNewSubtask] = useState("");
  const [userData, setUserData] = useState<any>(null);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  const [isTimeTrackingOpen, setIsTimeTrackingOpen] = useState(false);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [userTeams, setUserTeams] = useState<{id: string, name: string}[]>([]);
  const supabase = createClient();
  const { theme } = useTheme();

  // Fetch user data when component mounts
  useEffect(() => {
    const fetchUserData = async () => {
      const { data } = await supabase.auth.getUser();
      setUserData(data);
      
      // Fetch user's teams
      if (data?.user?.id) {
        await fetchUserTeams(data.user.id);
      }
    };

    fetchUserData();
  }, [supabase.auth]);

  // Fetch user's teams
  const fetchUserTeams = async (userId: string) => {
    try {
      // Fetch teams created by the user
      const { data: ownedTeams, error: ownedError } = await supabase
        .from("teams")
        .select("id, name")
        .eq("created_by", userId);

      if (ownedError) throw ownedError;

      // Fetch teams the user is a member of
      const { data: memberTeams, error: memberError } = await supabase
        .from("team_members")
        .select(`
          team_id,
          teams:team_id (
            id, 
            name
          )
        `)
        .eq("user_id", userId);

      if (memberError) throw memberError;

      // Combine teams
      const teams = [
        ...(ownedTeams || []).map(team => ({ id: team.id, name: team.name })),
        ...(memberTeams || []).filter(item => item.teams).map(item => ({ 
          id: (item.teams as any).id, 
          name: (item.teams as any).name 
        }))
      ];

      // Remove duplicates (if any)
      const uniqueTeams = teams.filter((team, index, self) => 
        index === self.findIndex(t => t.id === team.id)
      );

      setUserTeams(uniqueTeams);
    } catch (error) {
      console.error("Error fetching user teams:", error);
    }
  };

  // Set due date when task changes
  useEffect(() => {
    if (task?.due_date) {
      setDueDate(new Date(task.due_date).toISOString().slice(0, 16));
    } else {
      setDueDate("");
    }
  }, [task]);

  // Update component state when task changes
  useEffect(() => {
    if (task) {
      setDescription(task.description || "");
      setTitle(task.title);
      setDueDate(task.due_date || "");
      setTotalHours(task.time_spent || 0);
      
      // Fetch team name if task has a team_id
      const fetchTeamName = async () => {
        if (task.team_id) {
          try {
            const { data, error } = await supabase
              .from('teams')
              .select('name')
              .eq('id', task.team_id)
              .single();
              
            if (error) throw error;
            if (data) {
              setTeamName(data.name);
            }
          } catch (error) {
            console.error('Error fetching team name:', error);
          }
        } else {
          setTeamName(null);
        }
      };

      // Fetch time entries if task exists
      const fetchTimeEntries = async () => {
        if (task?.id) {
          try {
            const { data, error } = await supabase
              .from("time_entries")
              .select(`
                *,
                users:user_id (
                  name,
                  email,
                  avatar_url
                )
              `)
              .eq("task_id", task.id)
              .order("created_at", { ascending: false });

            if (error) throw error;
            
            // Process time entries
            const processedEntries = data.map((entry) => ({
              id: entry.id,
              task_id: entry.task_id,
              user_id: entry.user_id,
              hours: entry.hours,
              description: entry.description,
              created_at: entry.created_at,
              user_name: entry.users?.name || "",
              user_email: entry.users?.email || "",
              user_avatar_url: entry.users?.avatar_url || "",
            }));
            
            setTimeEntries(processedEntries);
            
            // Update total hours
            const total = processedEntries.reduce((sum, entry) => sum + entry.hours, 0);
            setTotalHours(total);
          } catch (error) {
            console.error("Error fetching time entries:", error);
          }
        }
      };
      
      fetchTeamName();
      fetchTimeEntries();
    }
  }, [task, supabase]);

  // Create a reusable function to fetch attachments
  const fetchAttachments = async () => {
    if (!task) return;
    
    try {
      const { data, error } = await supabase
        .from('task_attachments')
        .select(`
          *,
          user:users(name, email)
        `)
        .eq('task_id', task.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching attachments:', error);
        return;
      }

      setAttachments(data || []);
    } catch (error) {
      console.error('Error fetching attachments:', error);
    }
  };

  // Initial fetch of attachments when task changes
  useEffect(() => {
    if (task) {
      fetchAttachments();
    }
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Function to handle toggling a subtask
  const handleToggleSubtask = async (subtaskId: string, completed: boolean) => {
    if (!task) return;

    try {
      const { error } = await supabase
        .from("subtasks")
        .update({ completed })
        .eq("id", subtaskId);

      if (error) throw error;

      // Update local state
      setSubtasks((prev) =>
        prev.map((subtask) =>
          subtask.id === subtaskId ? { ...subtask, completed } : subtask,
        ),
      );

      if (onSubtasksChange) onSubtasksChange();
    } catch (error) {
      console.error("Error updating subtask:", error);
    }
  };

  // Function to handle deleting a subtask
  const handleDeleteSubtask = async (subtaskId: string) => {
    if (!task) return;

    try {
      const { error } = await supabase
        .from("subtasks")
        .delete()
        .eq("id", subtaskId);

      if (error) throw error;

      // Update local state
      setSubtasks((prev) => prev.filter((subtask) => subtask.id !== subtaskId));

      if (onSubtasksChange) onSubtasksChange();
    } catch (error) {
      console.error("Error deleting subtask:", error);
    }
  };

  // Fetch subtasks when dialog opens or task changes
  const fetchSubtasks = async () => {
    if (!task) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("subtasks")
        .select("*")
        .eq("task_id", task.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setSubtasks(data || []);
    } catch (error) {
      console.error("Error fetching subtasks:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Call fetchSubtasks when task changes
  useEffect(() => {
    if (task && isOpen) {
      fetchSubtasks();
    }
  }, [task, isOpen]);

  // Function to add a new subtask
  const handleAddSubtask = async () => {
    if (!task || !newSubtask.trim()) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data, error } = await supabase
        .from("subtasks")
        .insert([
          {
            task_id: task.id,
            title: newSubtask,
            completed: false,
            user_id: userData.user.id,
          },
        ])
        .select();

      if (error) throw error;
      if (data) {
        setSubtasks([...subtasks, data[0]]);
        setNewSubtask("");
        if (onSubtasksChange) onSubtasksChange();
      }
    } catch (error) {
      console.error("Error adding subtask:", error);
    }
  };

  // Function to update task status
  const handleStatusChange = async (
    status: "todo" | "in_progress" | "done",
  ) => {
    if (!task) return;

    try {
      // Check if task has unfinished dependencies and trying to mark as done or in progress
      if (
        (status === "done" || status === "in_progress") &&
        task.has_dependencies &&
        !task.dependencies_completed
      ) {
        alert(
          "Cannot change status: This task has dependencies that are not completed yet.",
        );
        return;
      }

      const { data, error } = await supabase
        .from("tasks")
        .update({ status })
        .eq("id", task.id)
        .select();

      if (error) throw error;
      if (data && onSubtasksChange) {
        onSubtasksChange();
      }
    } catch (error) {
      console.error("Error updating task status:", error);
    }
  };

  // Function to update task due date
  const handleUpdateDueDate = async () => {
    if (!task) return;

    try {
      const due_date = dueDate ? new Date(dueDate).toISOString() : null;

      const { data, error } = await supabase
        .from("tasks")
        .update({ due_date })
        .eq("id", task.id)
        .select();

      if (error) throw error;
      if (data && onSubtasksChange) {
        onSubtasksChange();
        setEditingDueDate(false);
      }
    } catch (error) {
      console.error("Error updating due date:", error);
    }
  };

  // Get priority color for styling
  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case "low":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "medium":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "high":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      case "urgent":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "todo":
        return <ListTodo className="h-4 w-4 text-gray-500" />;
      case "in_progress":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "done":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return null;
    }
  };

  // Check if task is overdue or due soon
  const isOverdue =
    task?.due_date &&
    new Date(task.due_date) < new Date() &&
    task.status !== "done";

  const isDueSoon =
    task?.due_date &&
    new Date(task.due_date) > new Date() &&
    new Date(task.due_date) < new Date(Date.now() + 24 * 60 * 60 * 1000) &&
    task.status !== "done";

  // Check if task is blocked by dependencies
  const isBlocked =
    task?.has_dependencies &&
    !task?.dependencies_completed &&
    task?.status !== "done";

  // Function to handle editing description
  const handleEditDescription = () => {
    setEditingDescription(true);
  };

  // Function to handle updating description
  const handleUpdateDescription = async () => {
    if (!task) return;

    try {
      const { error } = await supabase
        .from("tasks")
        .update({ description })
        .eq("id", task.id);

      if (error) throw error;
      setEditingDescription(false);
    } catch (error) {
      console.error("Error updating description:", error);
    }
  };

  // Function to handle updating priority
  const handlePriorityChange = async (priority: string) => {
    if (!task) return;

    try {
      const { error } = await supabase
        .from("tasks")
        .update({ priority })
        .eq("id", task.id);

      if (error) throw error;
    } catch (error) {
      console.error("Error updating priority:", error);
    }
  };

  // Handle time update from time tracking component
  const handleTimeUpdate = (updatedTotalHours: number) => {
    setTotalHours(updatedTotalHours);
  };

  // Function to handle team change
  const handleTeamChange = async (teamId: string | null) => {
    if (!task) return;

    try {
      const { error } = await supabase
        .from("tasks")
        .update({ team_id: teamId, assigned_to: null }) // Reset assigned_to when changing team
        .eq("id", task.id);

      if (error) throw error;
      
      if (onSubtasksChange) onSubtasksChange();
      
      // Update team name
      if (teamId) {
        const team = userTeams.find(team => team.id === teamId);
        setTeamName(team?.name || null);
      } else {
        setTeamName(null);
      }
    } catch (error) {
      console.error("Error updating team:", error);
    }
  };

  // Function to handle assignee change
  const handleAssigneeChange = async (userId: string | null) => {
    if (!task) return;

    try {
      const { error } = await supabase
        .from("tasks")
        .update({ assigned_to: userId })
        .eq("id", task.id);

      if (error) throw error;
      
      if (onSubtasksChange) onSubtasksChange();
    } catch (error) {
      console.error("Error updating assignee:", error);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[90%] md:max-w-[85%] lg:max-w-[80%] xl:max-w-[75%] 2xl:max-w-[70%] h-[85vh]">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {editingTitle ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="font-semibold flex-1"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingTitle(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={async () => {
                      if (!task) return;
                      try {
                        await supabase
                          .from("tasks")
                          .update({ title })
                          .eq("id", task.id);
                        setEditingTitle(false);
                      } catch (error) {
                        console.error("Error updating title:", error);
                      }
                    }}
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div
                  className="cursor-pointer group flex items-center gap-1"
                  onClick={() => setEditingTitle(true)}
                >
                  <span>{task?.title}</span>
                  <Edit className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 h-[calc(85vh-80px)] overflow-hidden">
            <Tabs defaultValue="details" className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="comments">Comments</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="flex-1 mt-4 overflow-auto data-[state=active]:flex data-[state=active]:flex-col">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-h-0 flex-1">
                  {/* Main content column */}
                  <div className="md:col-span-2 flex flex-col gap-4 min-h-0">
                    {/* Description section - Make it align with the first three cards in the sidebar */}
                    <Card className="flex flex-col" style={{ height: "min(310px, 30vh)" }}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-md">Description</CardTitle>
                      </CardHeader>
                      <CardContent className="overflow-auto flex-1 pr-2">
                        {editingDescription ? (
                          <div className="space-y-2">
                            <Textarea
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              className="min-h-[100px]"
                            />
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingDescription(false);
                                  setDescription(task?.description || "");
                                }}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={handleUpdateDescription}
                              >
                                Save
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className="min-h-[60px] cursor-pointer group"
                            onClick={handleEditDescription}
                          >
                            {task?.description ? (
                              <p className="whitespace-pre-wrap">{task.description}</p>
                            ) : (
                              <p className="text-muted-foreground italic">
                                No description provided.{" "}
                                <span className="text-primary group-hover:underline">
                                  Add one
                                </span>
                              </p>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Subtasks section */}
                    <Card className="flex flex-col">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-md">Subtasks</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <Input
                              placeholder="Add a subtask..."
                              value={newSubtask}
                              onChange={(e) => setNewSubtask(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && newSubtask.trim()) {
                                  handleAddSubtask();
                                }
                              }}
                              className="flex-1"
                            />
                            <Button onClick={handleAddSubtask} disabled={!newSubtask.trim()}>
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          {isLoading ? (
                            <div className="text-center py-4 text-sm text-muted-foreground">
                              Loading subtasks...
                            </div>
                          ) : (
                            <>
                              <div className="space-y-2 overflow-y-auto pr-2" style={{ maxHeight: subtasks.length > 5 ? "200px" : "auto" }}>
                                {subtasks.map((subtask) => (
                                  <div
                                    key={subtask.id}
                                    className="flex items-center justify-between p-2 bg-secondary/30 rounded-md"
                                  >
                                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                                      <Checkbox
                                        id={`view-subtask-${subtask.id}`}
                                        checked={subtask.completed}
                                        onCheckedChange={(checked) =>
                                          handleToggleSubtask(subtask.id, checked === true)
                                        }
                                      />
                                      <Label
                                        htmlFor={`view-subtask-${subtask.id}`}
                                        className={`text-sm truncate ${subtask.completed ? "line-through text-gray-500" : ""}`}
                                      >
                                        {subtask.title}
                                      </Label>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDeleteSubtask(subtask.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                              {subtasks.length > 5 && (
                                <div className="text-xs text-muted-foreground text-center mt-2">
                                  Showing all {subtasks.length} subtasks
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Comments section in details tab */}
                    <Card className="flex-1 min-h-0 flex flex-col">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-md">Comments</CardTitle>
                      </CardHeader>
                      <CardContent className="flex-1 overflow-auto">
                        {task && (
                          <TaskComments
                            taskId={task.id}
                            teamId={task.team_id || null}
                            currentUser={userData?.user}
                          />
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Sidebar column */}
                  <div className="flex flex-col gap-4 h-fit">
                    {/* Status section */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-md">Status</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Select
                          defaultValue={task?.status}
                          onValueChange={handleStatusChange}
                          disabled={task?.has_dependencies && !task?.dependencies_completed}
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                <>
                                  <div className="flex items-center space-x-2">
                                    {getStatusIcon(task?.status || "todo")}
                                    <span className="capitalize">
                                      {task?.status?.replace("_", " ") || "Todo"}
                                    </span>
                                  </div>
                                </>
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todo">
                              <div className="flex items-center space-x-2">
                                <ListTodo className="h-4 w-4" />
                                <span>Todo</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="in_progress">
                              <div className="flex items-center space-x-2">
                                <Clock className="h-4 w-4 text-blue-500" />
                                <span>In Progress</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="done">
                              <div className="flex items-center space-x-2">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <span>Done</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>

                        {task?.has_dependencies && !task?.dependencies_completed && (
                          <div className="flex items-center space-x-2 mt-2 text-yellow-500 text-sm">
                            <AlertTriangle className="h-4 w-4" />
                            <span>
                              Complete dependencies before changing status
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Time tracking summary */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-md">Time Spent</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-blue-500" />
                            <span className="font-medium">{totalHours.toFixed(1)} hours</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsTimeTrackingOpen(true)}
                          >
                            Manage
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Priority section */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-md">Priority</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Select
                          value={task?.priority || "medium"}
                          onValueChange={handlePriorityChange}
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                <>
                                  <div className="flex items-center space-x-2">
                                    {getPriorityColor(task?.priority || null)}
                                    <span className="capitalize">
                                      {task?.priority?.replace("_", " ") || "Medium"}
                                    </span>
                                  </div>
                                </>
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                                <span>Low</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="medium">
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full" />
                                <span>Medium</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="high">
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-orange-500 rounded-full" />
                                <span>High</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="urgent">
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-red-500 rounded-full" />
                                <span>Urgent</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </CardContent>
                    </Card>

                    {/* Due date section */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-md">Due Date</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {editingDueDate ? (
                          <div className="flex flex-col space-y-2">
                            <Input
                              id="due-date"
                              type="datetime-local"
                              value={dueDate}
                              onChange={(e) => setDueDate(e.target.value)}
                              className="w-full"
                            />
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={() => {
                                  setEditingDueDate(false);
                                  setDueDate(task?.due_date || "");
                                }}>
                                Cancel
                              </Button>
                              <Button variant="ghost" size="sm" onClick={handleUpdateDueDate}>
                                Save
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <div className="truncate text-sm">
                              {task?.due_date
                                ? new Date(task.due_date).toLocaleString()
                                : "No due date set"}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingDueDate(true)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Dependency section */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-md">Task Dependencies</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {task && userData?.user && (
                          <TaskDependencySelector
                            taskId={task.id}
                            userId={userData?.user?.id || ""}
                            onDependenciesChange={() => {
                              if (onSubtasksChange) onSubtasksChange();
                            }}
                            scrollCurrentDependencies={true}
                          />
                        )}
                      </CardContent>
                    </Card>

                    {/* Attachments section */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-md">Attachments</CardTitle>
                      </CardHeader>
                      <CardContent className="overflow-hidden">
                        {task && (
                          <div className="max-h-[200px] overflow-y-auto">
                            <TaskAttachments
                              taskId={task.id}
                              attachments={attachments}
                              onAttachmentAdded={() => fetchAttachments()}
                              onAttachmentDeleted={() => fetchAttachments()}
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Other sections */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-md">Team</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {userTeams.length > 0 ? (
                          <TeamSelector 
                            teams={userTeams}
                            value={task?.team_id || null}
                            onChange={handleTeamChange}
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate text-sm">{teamName || "No team"}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-md">Assigned To</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {task?.team_id ? (
                          <UserAssignmentSelector
                            teamId={task.team_id}
                            value={task.assigned_to || null}
                            onChange={handleAssigneeChange}
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <UserCircle className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate text-sm">Select a team first</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="comments" className="flex-1 mt-4 overflow-auto data-[state=active]:flex data-[state=active]:flex-col">
                <Card className="flex-1 min-h-0 flex flex-col">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-md">Comments</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-auto">
                    {task && (
                      <TaskComments
                        taskId={task.id}
                        teamId={task.team_id || null}
                        currentUser={userData?.user}
                      />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* Time tracking dialog */}
      <Dialog open={isTimeTrackingOpen} onOpenChange={setIsTimeTrackingOpen}>
        <DialogContent className="sm:max-w-[90%] md:max-w-[85%] lg:max-w-[80%] xl:max-w-[75%] 2xl:max-w-[70%]">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Time Tracking: {task?.title}
            </DialogTitle>
          </DialogHeader>
          {task && userData?.user?.id && (
            <TimeTracking
              taskId={task.id}
              userId={userData.user.id}
              initialTimeEntries={timeEntries}
              initialTotalHours={totalHours}
              onTimeUpdate={handleTimeUpdate}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
