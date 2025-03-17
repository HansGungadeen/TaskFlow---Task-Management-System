"use client";

import { useState, useEffect } from "react";
import { Check, X } from "lucide-react";
import { Button } from "./ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Badge } from "./ui/badge";
import { createClient } from "@/utils/utils";

type Task = {
  id: string;
  title: string;
  status: string;
};

type Dependency = {
  id: string;
  dependent_task_id: string;
  dependency_task_id: string;
};

type TaskDependencySelectorProps = {
  taskId: string;
  userId: string;
  onDependenciesChange?: () => void;
};

export default function TaskDependencySelector({
  taskId,
  userId,
  onDependenciesChange,
}: TaskDependencySelectorProps) {
  const [open, setOpen] = useState(false);
  const [availableTasks, setAvailableTasks] = useState<Task[]>([]);
  const [dependencies, setDependencies] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  // Fetch available tasks and current dependencies
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch all tasks except the current one
        const { data: tasksData, error: tasksError } = await supabase
          .from("tasks")
          .select("id, title, status")
          .eq("user_id", userId)
          .neq("id", taskId);

        if (tasksError) throw tasksError;

        // Fetch current dependencies
        const { data: dependenciesData, error: dependenciesError } =
          await supabase
            .from("task_dependencies")
            .select("id, dependency_task_id")
            .eq("dependent_task_id", taskId);

        if (dependenciesError) throw dependenciesError;

        // Get the full task objects for dependencies
        const dependencyTasks: Task[] = [];
        if (dependenciesData.length > 0) {
          const dependencyIds = dependenciesData.map(
            (dep) => dep.dependency_task_id,
          );
          const { data: depTasksData, error: depTasksError } = await supabase
            .from("tasks")
            .select("id, title, status")
            .in("id", dependencyIds);

          if (depTasksError) throw depTasksError;
          if (depTasksData) {
            dependencyTasks.push(...depTasksData);
          }
        }

        setAvailableTasks(tasksData || []);
        setDependencies(dependencyTasks);
      } catch (error) {
        console.error("Error fetching task dependencies:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (taskId && userId) {
      fetchData();
    }
  }, [taskId, userId, supabase]);

  const addDependency = async (dependencyTaskId: string) => {
    try {
      const { error } = await supabase.from("task_dependencies").insert({
        dependent_task_id: taskId,
        dependency_task_id: dependencyTaskId,
      });

      if (error) throw error;

      // Find the task in availableTasks and add it to dependencies
      const task = availableTasks.find((t) => t.id === dependencyTaskId);
      if (task) {
        setDependencies([...dependencies, task]);
      }

      if (onDependenciesChange) {
        onDependenciesChange();
      }
    } catch (error) {
      console.error("Error adding dependency:", error);
    }
  };

  const removeDependency = async (dependencyTaskId: string) => {
    try {
      const { error } = await supabase
        .from("task_dependencies")
        .delete()
        .eq("dependent_task_id", taskId)
        .eq("dependency_task_id", dependencyTaskId);

      if (error) throw error;

      // Remove the task from dependencies
      setDependencies(dependencies.filter((t) => t.id !== dependencyTaskId));

      if (onDependenciesChange) {
        onDependenciesChange();
      }
    } catch (error) {
      console.error("Error removing dependency:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "todo":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
      case "in_progress":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "done":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
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

  // Filter out tasks that are already dependencies
  const filteredAvailableTasks = availableTasks.filter(
    (task) => !dependencies.some((dep) => dep.id === task.id),
  );

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading dependencies...</div>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 mb-2">
        {dependencies.length > 0 ? (
          dependencies.map((task) => (
            <Badge
              key={task.id}
              variant="secondary"
              className="flex items-center gap-1"
            >
              <span className="max-w-[150px] truncate">{task.title}</span>
              <span
                className={`text-xs px-1 rounded-full ${getStatusColor(task.status)}`}
              >
                {getStatusText(task.status)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 ml-1"
                onClick={() => removeDependency(task.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))
        ) : (
          <div className="text-sm text-gray-500">No dependencies set</div>
        )}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 text-xs">
            Add Dependency
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0" align="start">
          <Command>
            <CommandInput placeholder="Search tasks..." />
            <CommandList>
              <CommandEmpty>No tasks found.</CommandEmpty>
              <CommandGroup>
                {filteredAvailableTasks.map((task) => (
                  <CommandItem
                    key={task.id}
                    onSelect={() => {
                      addDependency(task.id);
                      setOpen(false);
                    }}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="max-w-[200px] truncate">
                        {task.title}
                      </span>
                      <span
                        className={`text-xs px-1 rounded-full ${getStatusColor(task.status)}`}
                      >
                        {getStatusText(task.status)}
                      </span>
                    </div>
                    <Check className="h-4 w-4 opacity-0 group-data-[selected]:opacity-100" />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
