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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high" | "urgent" | null;
  created_at: string;
  due_date: string | null;
  reminder_sent: boolean | null;
  has_dependencies?: boolean;
  dependencies_completed?: boolean;
};

type TaskDashboardProps = {
  initialTasks: Task[];
};

export default function TaskDashboard({ initialTasks }: TaskDashboardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>(initialTasks);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    status: "todo" as const,
    priority: "medium" as const,
    due_date: null as string | null,
  });
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [dueDateFilter, setDueDateFilter] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [taskDependencies, setTaskDependencies] = useState<
    Record<string, string[]>
  >({});
  const [dependencyStatus, setDependencyStatus] = useState<
    Record<string, boolean>
  >({});
  const { theme } = useTheme();

  const supabase = createClient();

  // Set isClient to true once component mounts
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Fetch task dependencies
  useEffect(() => {
    const fetchTaskDependencies = async () => {
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

        // Update tasks with dependency information
        setTasks(
          tasks.map((task) => ({
            ...task,
            has_dependencies: dependencies[task.id]?.length > 0,
            dependencies_completed: status[task.id] || false,
          })),
        );
      } catch (error) {
        console.error("Error fetching task dependencies:", error);
      }
    };

    fetchTaskDependencies();
  }, [tasks, supabase]);

  // Apply filters when tasks or dueDateFilter changes
  useEffect(() => {
    if (!dueDateFilter) {
      setFilteredTasks(tasks);
      return;
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    let filtered;
    if (dueDateFilter === "today") {
      filtered = tasks.filter((task) => {
        if (!task.due_date) return false;
        const taskDate = new Date(task.due_date);
        return taskDate >= today && taskDate < tomorrow;
      });
    } else if (dueDateFilter === "tomorrow") {
      filtered = tasks.filter((task) => {
        if (!task.due_date) return false;
        const taskDate = new Date(task.due_date);
        const nextDay = new Date(tomorrow);
        nextDay.setDate(nextDay.getDate() + 1);
        return taskDate >= tomorrow && taskDate < nextDay;
      });
    } else if (dueDateFilter === "week") {
      filtered = tasks.filter((task) => {
        if (!task.due_date) return false;
        const taskDate = new Date(task.due_date);
        return taskDate >= today && taskDate < nextWeek;
      });
    } else if (dueDateFilter === "overdue") {
      filtered = tasks.filter((task) => {
        if (!task.due_date) return false;
        const taskDate = new Date(task.due_date);
        return taskDate < today && task.status !== "done";
      });
    } else if (dueDateFilter.startsWith("custom:")) {
      const customDate = new Date(dueDateFilter.substring(7));
      const nextDay = new Date(customDate);
      nextDay.setDate(nextDay.getDate() + 1);

      filtered = tasks.filter((task) => {
        if (!task.due_date) return false;
        const taskDate = new Date(task.due_date);
        return taskDate >= customDate && taskDate < nextDay;
      });
    } else {
      filtered = tasks;
    }

    setFilteredTasks(filtered);
  }, [tasks, dueDateFilter]);

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
      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("tasks")
        .insert([
          {
            title: newTask.title,
            description: newTask.description || null,
            status: newTask.status,
            priority: newTask.priority,
            due_date: newTask.due_date,
            user_id: userData.user.id,
          },
        ])
        .select();

      if (error) throw error;
      if (data) {
        setTasks([data[0], ...tasks]);
        setNewTask({
          title: "",
          description: "",
          status: "todo",
          priority: "medium",
          due_date: null,
        });
        setIsCreating(false);
      }
    } catch (error) {
      console.error("Error creating task:", error);
    }
  };

  const handleUpdateTask = async () => {
    if (!currentTask) return;

    try {
      const { data, error } = await supabase
        .from("tasks")
        .update({
          title: currentTask.title,
          description: currentTask.description,
          status: currentTask.status,
          priority: currentTask.priority,
          due_date: currentTask.due_date,
        })
        .eq("id", currentTask.id)
        .select();

      if (error) throw error;
      if (data) {
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

        <DueDateFilter onFilterChange={setDueDateFilter} />
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
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="Task title"
                  value={newTask.title}
                  onChange={(e) =>
                    setNewTask({ ...newTask, title: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Task description"
                  value={newTask.description}
                  onChange={(e) =>
                    setNewTask({ ...newTask, description: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={newTask.status}
                  onValueChange={(value: "todo" | "in_progress" | "done") =>
                    setNewTask({ ...newTask, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={newTask.priority}
                  onValueChange={(
                    value: "low" | "medium" | "high" | "urgent",
                  ) => setNewTask({ ...newTask, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="due-date">Due Date</Label>
                <Input
                  id="due-date"
                  type="datetime-local"
                  onChange={(e) =>
                    setNewTask({
                      ...newTask,
                      due_date: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : null,
                    })
                  }
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleCreateTask}>Create Task</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditing} onOpenChange={setIsEditing}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Task</DialogTitle>
            </DialogHeader>
            {currentTask && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-title">Title</Label>
                  <Input
                    id="edit-title"
                    value={currentTask.title}
                    onChange={(e) =>
                      setCurrentTask({ ...currentTask, title: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={currentTask.description || ""}
                    onChange={(e) =>
                      setCurrentTask({
                        ...currentTask,
                        description: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <Select
                    value={currentTask.status}
                    onValueChange={(value: "todo" | "in_progress" | "done") =>
                      setCurrentTask({ ...currentTask, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">To Do</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-priority">Priority</Label>
                  <Select
                    value={currentTask.priority || "medium"}
                    onValueChange={(
                      value: "low" | "medium" | "high" | "urgent",
                    ) => setCurrentTask({ ...currentTask, priority: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-due-date">Due Date</Label>
                  <Input
                    id="edit-due-date"
                    type="datetime-local"
                    value={
                      currentTask.due_date
                        ? new Date(currentTask.due_date)
                            .toISOString()
                            .slice(0, 16)
                        : ""
                    }
                    onChange={(e) =>
                      setCurrentTask({
                        ...currentTask,
                        due_date: e.target.value
                          ? new Date(e.target.value).toISOString()
                          : null,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-dependencies">Task Dependencies</Label>
                  <div className="mt-1">
                    {currentTask && (
                      <TaskDependencySelector
                        taskId={currentTask.id}
                        userId={currentTask.user_id}
                        onDependenciesChange={() => {
                          // Refresh dependencies after changes
                          const updatedTasks = [...tasks];
                          setTasks(updatedTasks);
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={handleUpdateTask}>Update Task</Button>
            </div>
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

function TaskCard({ task, onEdit, onDelete, onStatusChange }: TaskCardProps) {
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

  return (
    <Card
      className={
        isOverdue ? "border-red-500" : isDueSoon ? "border-yellow-500" : ""
      }
    >
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{task.title}</CardTitle>
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
            </div>
          </div>
          <div className="flex space-x-1">
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
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
  );
}
