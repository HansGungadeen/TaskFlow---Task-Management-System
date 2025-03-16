"use client";

import { useState } from "react";
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
import { Plus, Edit, Trash2, CheckCircle, Clock, ListTodo } from "lucide-react";
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

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done";
  created_at: string;
};

type TaskDashboardProps = {
  initialTasks: Task[];
};

export default function TaskDashboard({ initialTasks }: TaskDashboardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    status: "todo" as const,
  });
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const { theme } = useTheme();

  const supabase = createClient();

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
            user_id: userData.user.id,
          },
        ])
        .select();

      if (error) throw error;
      if (data) {
        setTasks([data[0], ...tasks]);
        setNewTask({ title: "", description: "", status: "todo" });
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
      const { data, error } = await supabase
        .from("tasks")
        .update({ status })
        .eq("id", id)
        .select();

      if (error) throw error;
      if (data) {
        setTasks(
          tasks.map((task) => (task.id === id ? { ...task, status } : task)),
        );
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

  const todoTasks = tasks.filter((task) => task.status === "todo");
  const inProgressTasks = tasks.filter((task) => task.status === "in_progress");
  const doneTasks = tasks.filter((task) => task.status === "done");

  return (
    <div className="space-y-6 bg-background text-foreground">
      <div className="flex justify-between items-center">
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
              {tasks.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No tasks yet. Create your first task!
                </p>
              ) : (
                tasks.map((task) => (
                  <div key={task.id} className="p-4">
                    <div className="grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-5 font-medium">{task.title}</div>
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
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">{task.title}</CardTitle>
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
      </CardContent>
      <CardFooter className="flex justify-between pt-2 border-t">
        <div className="text-xs text-gray-500">
          {new Date(task.created_at).toLocaleDateString()}
        </div>
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
      </CardFooter>
    </Card>
  );
}
