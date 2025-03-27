"use client";

import { useState, useEffect, useRef } from "react";
import { Check, ChevronsUpDown, X, Plus } from "lucide-react";
import { Button } from "./ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
} from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Badge } from "./ui/badge";
import { createClient } from "@/utils/utils";
import { Checkbox } from "./ui/checkbox";
import { Card } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";

type Task = {
  id: string;
  title: string;
  status: string;
  user_id?: string;
  team_id?: string | null;
  team_name?: string | null;
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
  const [searchValue, setSearchValue] = useState("");

  const supabase = createClient();

  // Fetch available tasks and current dependencies
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Get the user's teams
        const { data: userTeams, error: teamsError } = await supabase
          .from("team_members")
          .select("team_id")
          .eq("user_id", userId);
        
        if (teamsError) throw teamsError;
        
        // Create array of team IDs
        const teamIds = userTeams ? userTeams.map(team => team.team_id) : [];
        
        // Fetch all tasks except the current one that the user has access to:
        // 1. Tasks created by the user
        // 2. Tasks assigned to the user
        // 3. Tasks from teams the user is a member of
        let query = supabase
          .from("tasks")
          .select("id, title, status, user_id, team_id")
          .neq("id", taskId);
        
        // Build filter for: created by user OR assigned to user OR in user's teams
        let filters = `user_id.eq.${userId},assigned_to.eq.${userId}`;
        
        // Add team filters if user is part of any teams
        if (teamIds.length > 0) {
          const teamFilters = teamIds.map(id => `team_id.eq.${id}`).join(',');
          filters += `,${teamFilters}`;
        }
        
        // Apply the combined filter
        query = query.or(filters);
        
        const { data: tasksData, error: tasksError } = await query;
        
        if (tasksError) throw tasksError;

        // Get team names for all tasks with team_id
        const tasksWithTeams = [...(tasksData || [])] as Task[];
        const taskTeamIds = tasksWithTeams
          .filter(task => task.team_id)
          .map(task => task.team_id);
          
        if (taskTeamIds.length > 0) {
          const { data: teamsData, error: teamsInfoError } = await supabase
            .from("teams")
            .select("id, name")
            .in("id", taskTeamIds as string[]);
            
          if (!teamsInfoError && teamsData) {
            // Create a map of team ids to team names
            const teamMap: Record<string, string> = {};
            teamsData.forEach(team => {
              teamMap[team.id] = team.name;
            });
            
            // Add team names to tasks
            tasksWithTeams.forEach(task => {
              if (task.team_id && teamMap[task.team_id]) {
                task.team_name = teamMap[task.team_id];
              }
            });
          }
        }

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
            .select("id, title, status, user_id, team_id")
            .in("id", dependencyIds);

          if (depTasksError) throw depTasksError;
          if (depTasksData) {
            // Add team names to dependency tasks as well
            const depTasksWithTeams = [...depTasksData] as Task[];
            const depTeamIds = depTasksWithTeams
              .filter(task => task.team_id)
              .map(task => task.team_id);
              
            if (depTeamIds.length > 0) {
              const { data: depTeamsData } = await supabase
                .from("teams")
                .select("id, name")
                .in("id", depTeamIds as string[]);
                
              if (depTeamsData) {
                const teamMap: Record<string, string> = {};
                depTeamsData.forEach(team => {
                  teamMap[team.id] = team.name;
                });
                
                depTasksWithTeams.forEach(task => {
                  if (task.team_id && teamMap[task.team_id]) {
                    task.team_name = teamMap[task.team_id];
                  }
                });
              }
            }
            
            dependencyTasks.push(...depTasksWithTeams);
          }
        }

        setAvailableTasks(tasksWithTeams || []);
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
  }, [taskId, userId]);

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
    <div className="space-y-4">
      {dependencies.length === 0 ? (
        <div className="text-sm text-muted-foreground mb-2">No dependencies set</div>
      ) : (
        <div>
          <h3 className="text-sm font-medium mb-2">Current Dependencies</h3>
          <div className="space-y-2">
            {dependencies.map((task) => (
              <div
                key={task.id}
                className="flex flex-wrap items-center justify-between p-2 rounded-md border bg-background"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
                  <span className={`w-2 h-2 flex-shrink-0 rounded-full ${
                    task.status === "done" 
                      ? "bg-green-500" 
                      : task.status === "in_progress" 
                        ? "bg-blue-500" 
                        : "bg-gray-500"
                  }`} />
                  <span className="truncate font-medium text-sm">{task.title}</span>
                </div>
                {task.team_name && (
                  <span className="text-xs text-muted-foreground ml-4 mr-auto">
                    {task.team_name}
                  </span>
                )}
                <div className="flex items-center mt-1 md:mt-0 ml-auto">
                  <Badge
                    variant="outline"
                    className={`mr-2 text-xs whitespace-nowrap ${getStatusColor(task.status)}`}
                  >
                    {getStatusText(task.status)}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 flex-shrink-0"
                    onClick={() => removeDependency(task.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-sm w-full justify-between"
            role="combobox"
            aria-expanded={open}
          >
            <span>Select task dependencies...</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-2 w-[calc(100vw-2rem)] max-w-[350px]" align="start">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Command className="rounded-lg border flex-1">
                <CommandInput 
                  placeholder="Search tasks..." 
                  value={searchValue} 
                  onValueChange={setSearchValue}
                  className="h-9"
                />
              </Command>
            </div>
            
            {filteredAvailableTasks.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No matching tasks found
              </div>
            ) : (
              <ScrollArea className="h-72">
                <div className="space-y-2 px-1 py-2">
                  {filteredAvailableTasks.map((task) => (
                    <Card 
                      key={task.id}
                      className="p-3 hover:bg-accent cursor-pointer transition-colors"
                      onClick={() => {
                        addDependency(task.id);
                        setOpen(false);
                        setSearchValue("");
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <Checkbox
                          id={`task-${task.id}`}
                          className="mt-1 flex-shrink-0"
                          checked={false}
                          onCheckedChange={() => {
                            addDependency(task.id);
                            setOpen(false);
                            setSearchValue("");
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        />
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <label 
                            htmlFor={`task-${task.id}`}
                            className="text-sm font-medium block cursor-pointer truncate"
                          >
                            {task.title}
                          </label>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span
                              className="text-xs px-1.5 py-0.5 rounded-md whitespace-nowrap"
                              style={{ 
                                backgroundColor: task.status === 'todo' ? '#f3f4f6' : 
                                                task.status === 'in_progress' ? '#fef3c7' : 
                                                task.status === 'done' ? '#d1fae5' : '#f3f4f6',
                                color: task.status === 'todo' ? '#374151' : 
                                      task.status === 'in_progress' ? '#92400e' : 
                                      task.status === 'done' ? '#065f46' : '#374151'
                              }}
                            >
                              {getStatusText(task.status)}
                            </span>
                            {task.team_name && (
                              <span className="text-xs text-muted-foreground truncate">
                                {task.team_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
