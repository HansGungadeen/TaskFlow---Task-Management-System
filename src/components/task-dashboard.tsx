"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/utils";
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
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  Clock,
  ListTodo,
  Bell,
  Link,
  AlertTriangle,
  History,
  Users,
  Calendar,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
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
import { useTheme } from "next-themes";
import DueDateFilter from "./due-date-filter";
import TaskDependencySelector from "./task-dependency-selector";
import SubtaskList from "./subtask-list";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import TeamSelector from "./team-selector";
import { Badge } from "./ui/badge";
import UserAssignmentSelector from "./user-assignment-selector";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { AssigneeData, Task as TaskType, TaskStatus, TaskPriority } from "@/types/tasks";

type Subtask = {
  id: string;
  task_id: string;
  title: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
  user_id: string;
};

type Task = TaskType;

type Team = {
  id: string;
  name: string;
};

type TaskDashboardProps = {
  initialTasks: Task[];
  userTeams?: Team[];
  userId?: string;
  initialTeamFilter?: string | null;
  initialTaskId?: string;
};

export default function TaskDashboard({ 
  initialTasks, 
  userTeams = [], 
  userId,
  initialTeamFilter,
  initialTaskId
}: TaskDashboardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>(initialTasks);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    status: "todo" as TaskStatus,
    priority: "medium" as TaskPriority,
    due_date: null as string | null,
    team_id: null as string | null,
    assigned_to: null as string | null,
  });
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [dueDateFilter, setDueDateFilter] = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [taskDependencies, setTaskDependencies] = useState<
    Record<string, string[]>
  >({});
  const [dependencyStatus, setDependencyStatus] = useState<
    Record<string, boolean>
  >({});
  const { theme } = useTheme();

  const supabase = createClient();
  const [userData, setUserData] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<Record<string, AssigneeData[]>>({});

  // Set isClient to true once component mounts and fetch user data
  useEffect(() => {
    setIsClient(true);

    const fetchUserData = async () => {
      const { data } = await supabase.auth.getUser();
      setUserData(data);
    };

    fetchUserData();
  }, [supabase.auth]);

  // Fetch task dependencies, subtasks, and assignee data
  useEffect(() => {
    const fetchTaskDependenciesAndSubtasks = async () => {
      if (tasks.length === 0) return;

      try {
        // Get all dependencies for all tasks
        const { data: dependenciesData, error: dependenciesError } =
          await supabase
            .from("task_dependencies")
            .select("dependent_task_id, dependency_task_id")
            .in(
              "dependent_task_id",
              tasks.map((task) => task.id),
            );

        if (dependenciesError) throw dependenciesError;

        // Get subtask counts for all tasks
        const { data: subtasksData, error: subtasksError } = await supabase
          .from("subtasks")
          .select("task_id, completed")
          .in(
            "task_id",
            tasks.map((task) => task.id),
          );

        if (subtasksError) throw subtasksError;
        
        // Get assignee data for assigned tasks
        const assignedTaskIds = tasks
          .filter(task => task.assigned_to)
          .map(task => task.assigned_to);
          
        if (assignedTaskIds.length > 0) {
          const { data: assigneesData, error: assigneesError } = await supabase
            .from("users")
            .select("id, email, name, avatar_url")
            .in("id", assignedTaskIds as string[]);
            
          if (assigneesError) throw assigneesError;
          
          // Create a map of user IDs to user data
          const assigneeMap = (assigneesData || []).reduce((acc, user) => {
            acc[user.id] = user;
            return acc;
          }, {} as Record<string, AssigneeData>);
          
          // Update tasks with assignee data
          tasks.forEach(task => {
            if (task.assigned_to && assigneeMap[task.assigned_to]) {
              task.assignee_data = assigneeMap[task.assigned_to];
            }
          });
        }

        // Organize dependencies by dependent task
        const dependencies: Record<string, string[]> = {};
        dependenciesData?.forEach((dep) => {
          if (!dependencies[dep.dependent_task_id]) {
            dependencies[dep.dependent_task_id] = [];
          }
          dependencies[dep.dependent_task_id].push(dep.dependency_task_id);
        });

        setTaskDependencies(dependencies);

        // Check status of all dependencies
        const status: Record<string, boolean> = {};
        for (const taskId in dependencies) {
          const dependencyIds = dependencies[taskId];
          const dependencyTasks = tasks.filter((task) =>
            dependencyIds.includes(task.id),
          );
          status[taskId] = dependencyTasks.every(
            (task) => task.status === "done",
          );
        }

        setDependencyStatus(status);

        // Calculate subtask counts for each task
        const subtaskCounts: Record<
          string,
          { total: number; completed: number }
        > = {};
        subtasksData?.forEach((subtask) => {
          if (!subtaskCounts[subtask.task_id]) {
            subtaskCounts[subtask.task_id] = { total: 0, completed: 0 };
          }
          subtaskCounts[subtask.task_id].total += 1;
          if (subtask.completed) {
            subtaskCounts[subtask.task_id].completed += 1;
          }
        });

        // Update tasks with dependency and subtask information
        const updatedTasks = tasks.map((task) => ({
          ...task,
          has_dependencies: dependencies[task.id]?.length > 0,
          dependencies_completed: status[task.id] || false,
          subtasks_count: subtaskCounts[task.id]?.total || 0,
          completed_subtasks_count: subtaskCounts[task.id]?.completed || 0,
        }));

        // Only update if there are actual changes to prevent infinite loops
        const hasChanges =
          JSON.stringify(updatedTasks) !== JSON.stringify(tasks);
        if (hasChanges) {
          setTasks(updatedTasks);
        }
      } catch (error) {
        console.error("Error fetching task dependencies and subtasks:", error);
      }
    };

    fetchTaskDependenciesAndSubtasks();
  }, [tasks.length]);

  // Apply filters when tasks, dueDateFilter, or teamFilter changes
  useEffect(() => {
    let filtered = tasks;
    
    // Apply due date filter if set
    if (dueDateFilter) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);

      if (dueDateFilter === "today") {
        filtered = filtered.filter((task) => {
          if (!task.due_date) return false;
          const taskDate = new Date(task.due_date);
          return taskDate >= today && taskDate < tomorrow;
        });
      } else if (dueDateFilter === "tomorrow") {
        filtered = filtered.filter((task) => {
          if (!task.due_date) return false;
          const taskDate = new Date(task.due_date);
          const nextDay = new Date(tomorrow);
          nextDay.setDate(nextDay.getDate() + 1);
          return taskDate >= tomorrow && taskDate < nextDay;
        });
      } else if (dueDateFilter === "week") {
        filtered = filtered.filter((task) => {
          if (!task.due_date) return false;
          const taskDate = new Date(task.due_date);
          return taskDate >= today && taskDate < nextWeek;
        });
      } else if (dueDateFilter === "overdue") {
        filtered = filtered.filter((task) => {
          if (!task.due_date) return false;
          const taskDate = new Date(task.due_date);
          return taskDate < today && task.status !== "done";
        });
      }
    }
    
    // Apply team filter if set
    if (teamFilter) {
      filtered = filtered.filter((task) => task.team_id === teamFilter);
    }
    
    // Apply assignee filter if set
    if (assigneeFilter) {
      if (assigneeFilter === 'unassigned') {
        filtered = filtered.filter((task) => !task.assigned_to);
      } else if (assigneeFilter === 'mine') {
        filtered = filtered.filter((task) => task.assigned_to === userId);
      } else {
        filtered = filtered.filter((task) => task.assigned_to === assigneeFilter);
      }
    }
    
    setFilteredTasks(filtered);
  }, [tasks, dueDateFilter, teamFilter, assigneeFilter, userId]);

  // Fetch team members when a team is selected
  useEffect(() => {
    const fetchTeamMembers = async (teamId: string) => {
      if (teamMembers[teamId]) return; // Already fetched
      
      try {
        const { data, error } = await supabase
          .from("team_members_with_users")
          .select("*")
          .eq("team_id", teamId);

        if (error) throw error;

        if (data) {
          const members: AssigneeData[] = data.map(member => ({
            id: member.user_id,
            email: member.user_email || '',
            name: member.user_name || undefined,
            avatar_url: member.user_avatar_url || undefined
          }));
          
          setTeamMembers(prev => ({
            ...prev,
            [teamId]: members
          }));
        }
      } catch (error) {
        console.error("Error fetching team members:", error);
      }
    };

    // Fetch members for tasks with teams
    tasks.forEach(task => {
      if (task.team_id && !teamMembers[task.team_id]) {
        fetchTeamMembers(task.team_id);
      }
    });
  }, [tasks, teamMembers, supabase]);

  // Set initial team filter if provided
  useEffect(() => {
    if (initialTeamFilter) {
      setTeamFilter(initialTeamFilter);
    }
  }, [initialTeamFilter]);

  // Open task if initialTaskId is provided
  useEffect(() => {
    if (initialTaskId && tasks.length > 0) {
      const taskToOpen = tasks.find(task => task.id === initialTaskId);
      if (taskToOpen) {
        setCurrentTask(taskToOpen);
        setIsEditing(true);
      }
    }
  }, [initialTaskId, tasks]);

  // Function to send reminders manually
  const sendReminders = async () => {
    try {
      const response = await fetch("/api/task-reminders");
      const data = await response.json();

      if (data.error) {
        console.error("Error sending reminders:", data.error);
        return;
      }

      console.log(`Sent ${data.processed} reminders`);

      // Refresh tasks to update reminder_sent status
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: refreshedTasks } = await supabase
          .from("tasks")
          .select("*")
          .eq("user_id", userData.user.id);

        if (refreshedTasks) {
          setTasks(refreshedTasks);
        }
      }
    } catch (error) {
      console.error("Error in sendReminders:", error);
    }
  };

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) return;

    try {
      const { data, error } = await supabase
        .from("tasks")
        .insert([
          {
            title: newTask.title.trim(),
            description: newTask.description.trim() || null,
            status: newTask.status,
            priority: newTask.priority,
            due_date: newTask.due_date,
            team_id: newTask.team_id,
            assigned_to: newTask.assigned_to,
            user_id: userId,
          },
        ])
        .select();

      if (error) throw error;

      if (data && data[0]) {
        setTasks([data[0], ...tasks]);
        setNewTask({
          title: "",
          description: "",
          status: "todo",
          priority: "medium",
          due_date: null,
          team_id: null,
          assigned_to: null,
        });
        setIsCreating(false);
      }
    } catch (error) {
      console.error("Error creating task:", error);
    }
  };

  const handleUpdateTask = async () => {
    if (!currentTask || !currentTask.title.trim()) return;

    try {
      const { data, error } = await supabase
        .from("tasks")
        .update({
          title: currentTask.title.trim(),
          description: currentTask.description?.trim() || null,
          status: currentTask.status,
          priority: currentTask.priority,
          due_date: currentTask.due_date,
          team_id: currentTask.team_id,
          assigned_to: currentTask.assigned_to,
        })
        .eq("id", currentTask.id)
        .select();

      if (error) throw error;

      if (data && data[0]) {
        setTasks(
          tasks.map((task) => (task.id === currentTask.id ? data[0] : task)),
        );
        setIsEditing(false);
        setCurrentTask(null);
      }
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
      setTasks(tasks.filter((task) => task.id !== id));
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  const handleStatusChange = async (
    id: string,
    status: "todo" | "in_progress" | "done",
  ) => {
    try {
      // Check if task has unfinished dependencies and trying to mark as done or in progress
      const task = tasks.find((t) => t.id === id);
      if (
        task &&
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
        .eq("id", id)
        .select();

      if (error) throw error;
      if (data) {
        // Update the task in the state
        const updatedTasks = tasks.map((task) =>
          task.id === id ? { ...task, status } : task,
        );
        setTasks(updatedTasks);

        // Refresh dependency status for tasks that depend on this one
        const dependentTasks = Object.entries(taskDependencies)
          .filter(([_, deps]) => deps.includes(id))
          .map(([taskId]) => taskId);

        if (dependentTasks.length > 0) {
          const newDependencyStatus = { ...dependencyStatus };

          dependentTasks.forEach((taskId) => {
            const deps = taskDependencies[taskId] || [];
            const depTasks = updatedTasks.filter((t) => deps.includes(t.id));
            newDependencyStatus[taskId] = depTasks.every(
              (t) => t.status === "done",
            );
          });

          setDependencyStatus(newDependencyStatus);
        }
      }
    } catch (error) {
      console.error("Error updating task status:", error);
    }
  };

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

  const getStatusText = (status: string) => {
    switch (status) {
      case "todo":
        return "To Do";
      case "in_progress":
        return "In Progress";
      case "done":
        return "Done";
      default:
        return status;
    }
  };

  const todoTasks = filteredTasks.filter((task) => task.status === "todo");
  const inProgressTasks = filteredTasks.filter(
    (task) => task.status === "in_progress",
  );
  const doneTasks = filteredTasks.filter((task) => task.status === "done");

  // Only render the full component on the client side
  if (!isClient) {
    return (
      <div className="space-y-6 bg-background text-foreground">Loading...</div>
    );
  }

  // Get initials for avatar fallback
  const getInitials = (task: Task): string => {
    if (!task.assignee_data) return 'UN';
    
    if (task.assignee_data.name) {
      return task.assignee_data.name
        .split(' ')
        .map(part => part[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
    }
    
    return task.assignee_data.email.substring(0, 2).toUpperCase();
  };

  // Render task form (new or edit)
  const renderTaskForm = () => {
    const isNewTask = !isEditing;
    const task = isNewTask ? newTask : currentTask;
    const setTask = isNewTask
      ? setNewTask
      : (updates: Partial<Task>) =>
          setCurrentTask((prev) => ({ ...prev!, ...updates }));
    const handleSubmit = isNewTask ? handleCreateTask : handleUpdateTask;

    if (!task) return null;

    return (
      <div className="flex flex-col gap-4">
        <div>
          <Label htmlFor={`${isNewTask ? "new" : "edit"}-task-title`}>
            Title
          </Label>
          <Input
            id={`${isNewTask ? "new" : "edit"}-task-title`}
            value={task.title}
            onChange={(e) => setTask({ ...task, title: e.target.value })}
            placeholder="Enter task title"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor={`${isNewTask ? "new" : "edit"}-task-description`}>
            Description
          </Label>
          <Textarea
            id={`${isNewTask ? "new" : "edit"}-task-description`}
            value={task.description || ""}
            onChange={(e) =>
              setTask({ ...task, description: e.target.value })
            }
            placeholder="Enter task description"
            className="mt-1"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor={`${isNewTask ? "new" : "edit"}-task-status`}>
              Status
            </Label>
            <Select
              value={task.status}
              onValueChange={(value) =>
                setTask({
                  ...task,
                  status: value as TaskStatus,
                })
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">To Do</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor={`${isNewTask ? "new" : "edit"}-task-priority`}>
              Priority
            </Label>
            <Select
              value={task.priority || "medium"}
              onValueChange={(value) =>
                setTask({
                  ...task,
                  priority: value as TaskPriority,
                })
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor={`${isNewTask ? "new" : "edit"}-task-due-date`}>
            Due Date
          </Label>
          <Input
            id={`${isNewTask ? "new" : "edit"}-task-due-date`}
            type="date"
            value={task.due_date || ""}
            onChange={(e) => setTask({ ...task, due_date: e.target.value })}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor={`${isNewTask ? "new" : "edit"}-task-team`}>
            Team
          </Label>
          <TeamSelector
            teams={userTeams}
            value={task.team_id}
            onChange={(teamId) => setTask({ ...task, team_id: teamId, assigned_to: null })}
          />
        </div>

        {task.team_id && (
          <div>
            <Label htmlFor={`${isNewTask ? "new" : "edit"}-task-assignee`}>
              Assigned To
            </Label>
            <UserAssignmentSelector 
              teamId={task.team_id}
              value={task.assigned_to || null}
              onChange={(userId) => setTask({ ...task, assigned_to: userId })}
            />
          </div>
        )}

        {/* Show dependencies and subtasks only in edit mode */}
        {!isNewTask && currentTask && (
          <>
            <div>
              <Label htmlFor="edit-dependencies">Task Dependencies</Label>
              <div className="mt-1">
                <TaskDependencySelector
                  taskId={currentTask.id}
                  userId={userId || ""}
                  onDependenciesChange={() => {
                    // Fetch updated task dependencies without causing a re-render loop
                    const fetchUpdatedDependencies = async () => {
                      try {
                        const { data: updatedTasksData } = await supabase
                          .from("tasks")
                          .select("*")
                          .eq("user_id", userId || "");

                        if (updatedTasksData) {
                          // Only update if there are actual changes
                          const hasChanges =
                            JSON.stringify(updatedTasksData) !==
                            JSON.stringify(tasks);
                          if (hasChanges) {
                            setTasks(updatedTasksData);
                          }
                        }
                      } catch (error) {
                        console.error("Error refreshing tasks:", error);
                      }
                    };

                    fetchUpdatedDependencies();
                  }}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit-subtasks">Subtasks</Label>
              <div className="mt-1">
                <SubtaskList
                  taskId={currentTask.id}
                  userId={userId || ""}
                  onSubtasksChange={() => {
                    // Fetch updated tasks without causing a re-render loop
                    const fetchUpdatedTasks = async () => {
                      try {
                        const { data: updatedTasksData } = await supabase
                          .from("tasks")
                          .select("*")
                          .eq("user_id", userId || "");

                        if (updatedTasksData) {
                          // Only update if there are actual changes
                          const hasChanges =
                            JSON.stringify(updatedTasksData) !==
                            JSON.stringify(tasks);
                          if (hasChanges) {
                            setTasks(updatedTasksData);
                          }
                        }
                      } catch (error) {
                        console.error("Error refreshing tasks:", error);
                      }
                    };

                    fetchUpdatedTasks();
                  }}
                />
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button
            variant="outline"
            onClick={() => {
              if (isNewTask) {
                setIsCreating(false);
              } else {
                setIsEditing(false);
                setCurrentTask(null);
              }
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            {isNewTask ? "Create Task" : "Update Task"}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 bg-background text-foreground">
      <div className="flex flex-col space-y-4 md:space-y-0 md:flex-row md:justify-between md:items-center">
        <div className="flex items-center space-x-2">
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("grid")}
          >
            Grid View
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
          >
            List View
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
            onClick={sendReminders}
          >
            <Bell className="h-4 w-4" /> Send Reminders
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row justify-between gap-2 mb-6">
          <div className="flex flex-wrap gap-2">
            <DueDateFilter
              value={dueDateFilter}
              onChange={(value) => setDueDateFilter(value)}
            />
            
            {userTeams && userTeams.length > 0 && (
              <Select
                value={teamFilter || "all"}
                onValueChange={(value) => setTeamFilter(value === "all" ? null : value)}
              >
                <SelectTrigger className="h-9 w-[180px]">
                  <SelectValue placeholder="Filter by team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tasks</SelectItem>
                  <SelectItem value="personal">Personal Tasks</SelectItem>
                  {userTeams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            <Button
              variant="outline"
              className="h-9"
              onClick={() => {
                setDueDateFilter(null);
                setTeamFilter(null);
              }}
            >
              Clear Filters
            </Button>
          </div>
        </div>

        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-1">
              <Plus className="h-4 w-4" /> New Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
            </DialogHeader>
            {renderTaskForm()}
          </DialogContent>
        </Dialog>

        <Dialog open={isEditing} onOpenChange={setIsEditing}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Task</DialogTitle>
            </DialogHeader>
            {renderTaskForm()}
          </DialogContent>
        </Dialog>
      </div>

      {viewMode === "grid" ? (
        <Tabs defaultValue="todo" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="todo" className="flex items-center gap-1">
              <ListTodo className="h-4 w-4" /> To Do ({todoTasks.length})
            </TabsTrigger>
            <TabsTrigger
              value="in_progress"
              className="flex items-center gap-1"
            >
              <Clock className="h-4 w-4" /> In Progress (
              {inProgressTasks.length})
            </TabsTrigger>
            <TabsTrigger value="done" className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4" /> Done ({doneTasks.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="todo" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {todoTasks.length === 0 ? (
                <p className="text-gray-500 col-span-full text-center py-8">
                  No tasks to do yet. Create your first task!
                </p>
              ) : (
                todoTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onEdit={() => {
                      setCurrentTask(task);
                      setIsEditing(true);
                    }}
                    onDelete={() => handleDeleteTask(task.id)}
                    onStatusChange={handleStatusChange}
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="in_progress" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inProgressTasks.length === 0 ? (
                <p className="text-gray-500 col-span-full text-center py-8">
                  No tasks in progress.
                </p>
              ) : (
                inProgressTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onEdit={() => {
                      setCurrentTask(task);
                      setIsEditing(true);
                    }}
                    onDelete={() => handleDeleteTask(task.id)}
                    onStatusChange={handleStatusChange}
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="done" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {doneTasks.length === 0 ? (
                <p className="text-gray-500 col-span-full text-center py-8">
                  No completed tasks yet.
                </p>
              ) : (
                doneTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onEdit={() => {
                      setCurrentTask(task);
                      setIsEditing(true);
                    }}
                    onDelete={() => handleDeleteTask(task.id)}
                    onStatusChange={handleStatusChange}
                  />
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-6">
          <div className="rounded-md border">
            <div className="bg-gray-50 p-4 font-medium">
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-5">Title</div>
                <div className="col-span-4">Description</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-1">Actions</div>
              </div>
            </div>
            <div className="divide-y">
              {filteredTasks.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No tasks yet. Create your first task!
                </p>
              ) : (
                filteredTasks.map((task) => (
                  <div key={task.id} className="p-4">
                    <div className="grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-5 font-medium flex items-center gap-2">
                        {task.title}
                        <div className="flex flex-wrap gap-1">
                          {task.priority && (
                            <span
                              className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(task.priority)}`}
                            >
                              {task.priority.charAt(0).toUpperCase() +
                                task.priority.slice(1)}
                            </span>
                          )}
                          {task.due_date && (
                            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                              Due:{" "}
                              {new Date(task.due_date).toLocaleDateString(
                                "en-US",
                                { month: "short", day: "numeric" },
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="col-span-4 text-sm text-gray-500 truncate">
                        {task.description || "No description"}
                      </div>
                      <div className="col-span-2">
                        <div className="flex items-center gap-1">
                          {getStatusIcon(task.status)}
                          <Select
                            value={task.status}
                            onValueChange={(
                              value: "todo" | "in_progress" | "done",
                            ) => handleStatusChange(task.id, value)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todo">To Do</SelectItem>
                              <SelectItem value="in_progress">
                                In Progress
                              </SelectItem>
                              <SelectItem value="done">Done</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="col-span-1 flex space-x-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setCurrentTask(task);
                            setIsEditing(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteTask(task.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type TaskCardProps = {
  task: Task;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (id: string, status: "todo" | "in_progress" | "done") => void;
};

import TaskHistory from "./task-history";

import TaskViewCard from "./task-view-card";

function TaskCard({ task, onEdit, onDelete, onStatusChange }: TaskCardProps) {
  const [viewTaskOpen, setViewTaskOpen] = useState(false);
  const [teamName, setTeamName] = useState<string | null>(null);
  const hasSubtasks = task.subtasks_count && task.subtasks_count > 0;
  const supabase = createClient();
  
  // Fetch team name if task has a team
  useEffect(() => {
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
      }
    };
    
    fetchTeamName();
  }, [task.team_id, supabase]);
  
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

  const isOverdue =
    task.due_date &&
    new Date(task.due_date) < new Date() &&
    task.status !== "done";
  const isDueSoon =
    task.due_date &&
    new Date(task.due_date) > new Date() &&
    new Date(task.due_date) < new Date(Date.now() + 24 * 60 * 60 * 1000) &&
    task.status !== "done";

  const hasDependencies = task.has_dependencies;
  const dependenciesCompleted = task.dependencies_completed;
  const isBlocked =
    hasDependencies && !dependenciesCompleted && task.status !== "done";

  const handleSubtasksChange = () => {
    // Refresh the task data when subtasks change
    if (onStatusChange) {
      // This is a hack to refresh the task data without changing the status
      onStatusChange(task.id, task.status);
    }
  };

  return (
    <>
      <Card
        className={
          isOverdue ? "border-red-500" : isDueSoon ? "border-yellow-500" : ""
        }
      >
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle
                className="text-lg cursor-pointer hover:text-primary transition-colors"
                onClick={() => setViewTaskOpen(true)}
              >
                {task.title}
              </CardTitle>
              <div className="flex flex-wrap gap-1 mt-1">
                {task.priority && (
                  <span
                    className={`text-xs px-2 py-1 rounded-full inline-block ${getPriorityColor(task.priority)}`}
                  >
                    {task.priority.charAt(0).toUpperCase() +
                      task.priority.slice(1)}
                  </span>
                )}
                {isOverdue && (
                  <span className="text-xs px-2 py-1 rounded-full inline-block bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                    Overdue
                  </span>
                )}
                {isDueSoon && (
                  <span className="text-xs px-2 py-1 rounded-full inline-block bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
                    Due Soon
                  </span>
                )}
                {teamName && (
                  <span className="text-xs px-2 py-1 rounded-full inline-block bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300 flex items-center gap-1">
                    <Users className="h-3 w-3" /> {teamName}
                  </span>
                )}
                {isBlocked && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs px-2 py-1 rounded-full inline-block bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300 flex items-center gap-1">
                          <Link className="h-3 w-3" /> Blocked
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          This task has dependencies that are not completed yet
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {hasSubtasks && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className="text-xs px-2 py-1 rounded-full inline-block bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 flex items-center gap-1 cursor-pointer"
                          onClick={() => setViewTaskOpen(true)}
                        >
                          Subtasks {task.completed_subtasks_count}/
                          {task.subtasks_count}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {task.completed_subtasks_count} of{" "}
                          {task.subtasks_count} subtasks completed
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
            <div className="flex space-x-1">
              <TaskHistory taskId={task.id} taskTitle={task.title} />
              <Button variant="ghost" size="icon" onClick={onEdit}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent
          className="cursor-pointer"
          onClick={() => setViewTaskOpen(true)}
        >
          <p className="text-sm text-gray-500 min-h-[40px]">
            {task.description || "No description"}
          </p>
          {task.due_date && (
            <p
              className={`text-xs mt-2 ${isOverdue ? "text-red-500 font-medium" : isDueSoon ? "text-yellow-600 font-medium" : "text-gray-500"}`}
            >
              Due:{" "}
              {new Date(task.due_date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex justify-between pt-2 border-t">
          <div className="text-xs text-gray-500">
            {new Date(task.created_at).toLocaleDateString("en-US")}
          </div>
          <div className="flex items-center gap-2">
            {isBlocked && task.status !== "done" && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>This task has dependencies that are not completed yet</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Select
              value={task.status}
              onValueChange={(value: "todo" | "in_progress" | "done") =>
                onStatusChange(task.id, value)
              }
            >
              <SelectTrigger className="h-8 w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">To Do</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardFooter>
      </Card>

      <TaskViewCard
        task={task}
        isOpen={viewTaskOpen}
        onClose={() => setViewTaskOpen(false)}
        onSubtasksChange={handleSubtasksChange}
      />
    </>
  );
}
