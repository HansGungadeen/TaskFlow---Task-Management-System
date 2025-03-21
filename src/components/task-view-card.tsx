"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/utils";
import { Task, Subtask } from "@/types/tasks";
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
} from "lucide-react";
import { useTheme } from "next-themes";
import TaskDependencySelector from "./task-dependency-selector";
import {
  Trash2,
  Plus,
  Edit,
  Save,
  X,
} from "lucide-react";
import { Checkbox } from "./ui/checkbox";

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
  const supabase = createClient();
  const { theme } = useTheme();

  // Fetch user data when component mounts
  useEffect(() => {
    const fetchUserData = async () => {
      const { data } = await supabase.auth.getUser();
      setUserData(data);
    };

    fetchUserData();
  }, [supabase.auth]);

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
      
      fetchTeamName();
    }
  }, [task, supabase]);

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

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Task Details</DialogTitle>
        </DialogHeader>

        {task && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
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
                              Blocked
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              This task has dependencies that are not completed
                              yet
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {teamName && (
                      <span className="text-xs px-2 py-1 rounded-full inline-block bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300 flex items-center gap-1">
                        <Users className="h-3 w-3" /> {teamName}
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <p className="text-sm text-gray-500">
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

              <CardFooter className="flex flex-col space-y-3 pt-2 border-t">
                <div className="flex justify-between w-full items-center">
                  <div className="text-xs text-gray-500">
                    Created:{" "}
                    {new Date(task.created_at).toLocaleDateString("en-US")}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      {getStatusIcon(task.status)}
                      <Select
                        value={task.status}
                        onValueChange={(
                          value: "todo" | "in_progress" | "done",
                        ) => handleStatusChange(value)}
                      >
                        <SelectTrigger className="h-8 w-[130px]">
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
                </div>

                <div className="flex justify-between w-full items-center">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">Due Date:</span>
                  </div>
                  {editingDueDate ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="datetime-local"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="h-8 w-[200px]"
                      />
                      <Button size="sm" onClick={handleUpdateDueDate}>
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingDueDate(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm">
                        {task.due_date
                          ? new Date(task.due_date).toLocaleDateString(
                              "en-US",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )
                          : "Not set"}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingDueDate(true)}
                      >
                        Edit
                      </Button>
                    </div>
                  )}
                </div>
              </CardFooter>
            </Card>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="text-md font-medium">Subtasks</h3>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Add new subtask"
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    className="h-8 w-[200px]"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleAddSubtask();
                      }
                    }}
                  />
                  <Button size="sm" onClick={handleAddSubtask}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {isLoading ? (
                <div className="text-sm text-gray-500">Loading subtasks...</div>
              ) : subtasks.length === 0 ? (
                <div className="text-sm text-gray-500 py-2">
                  No subtasks for this task
                </div>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {subtasks.map((subtask) => (
                    <div
                      key={subtask.id}
                      className="flex items-center justify-between py-1 px-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`view-subtask-${subtask.id}`}
                          checked={subtask.completed}
                          onCheckedChange={(checked) =>
                            handleToggleSubtask(subtask.id, checked === true)
                          }
                        />
                        <Label
                          htmlFor={`view-subtask-${subtask.id}`}
                          className={`text-sm ${subtask.completed ? "line-through text-gray-500" : ""}`}
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
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Link className="h-4 w-4 text-gray-500" />
                <h3 className="text-md font-medium">Task Dependencies</h3>
              </div>

              {task && userData?.user && (
                <TaskDependencySelector
                  taskId={task.id}
                  userId={userData?.user?.id || ""}
                  onDependenciesChange={() => {
                    if (onSubtasksChange) onSubtasksChange();
                  }}
                />
              )}
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
