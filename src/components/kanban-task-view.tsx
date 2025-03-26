"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/utils";
import KanbanBoard from "./kanban-board";
import { Task, TaskStatus } from "@/types/tasks";
import { Team } from "@/types/teams";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Plus } from "lucide-react";
import TaskViewCard from "./task-view-card";
import TeamSelector from "./team-selector";
import UserAssignmentSelector from "./user-assignment-selector";
import SubtaskList from "./subtask-list";
import TaskDependencySelector from "./task-dependency-selector";

interface KanbanTaskViewProps {
  initialTasks: Task[];
  userTeams?: { id: string; name: string }[];
  userId: string;
  initialTeamFilter?: string | null;
  initialTaskId?: string;
}

export default function KanbanTaskView({
  initialTasks,
  userTeams = [],
  userId,
  initialTeamFilter,
  initialTaskId,
}: KanbanTaskViewProps) {
  // Debug log initial props at component entry
  console.log('DIRECT PROP CHECK KanbanTaskView initialTasks:', 
    Array.isArray(initialTasks) ? initialTasks.length : 'not an array',
    JSON.stringify(initialTasks?.slice(0, 2)),
    'userId:', userId,
    'initialTeamFilter:', initialTeamFilter);

  const router = useRouter();
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>(initialTasks || []);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [teamFilter, setTeamFilter] = useState<string | null>(initialTeamFilter || null);
  const [isViewingTask, setIsViewingTask] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(initialTaskId || null);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    status: "todo" as TaskStatus,
    priority: "medium",
    due_date: null as string | null,
    team_id: teamFilter,
    assigned_to: null as string | null,
  });
  
  const supabase = createClient();
  
  // Log initial props on mount
  useEffect(() => {
    console.log("KanbanTaskView mounted with:", {
      initialTasksCount: initialTasks?.length || 0,
      teamCount: userTeams?.length || 0,
      userId,
      initialTeamFilter,
      initialTaskId
    });
  }, []);
  
  // Immediately set initial tasks while async loading occurs
  useEffect(() => {
    console.log("Setting initial tasks:", initialTasks?.length || 0, JSON.stringify(initialTasks?.slice(0, 2)));
    if (Array.isArray(initialTasks) && initialTasks.length > 0) {
      // Create a deep copy to ensure reactivity
      const processedTasks = initialTasks.map(task => ({
        ...task,
        // Ensure all required fields exist
        status: task.status || "todo",
        subtasks_count: task.subtasks_count || 0,
        completed_subtasks_count: task.completed_subtasks_count || 0,
        has_dependencies: task.has_dependencies || false,
        dependencies_completed: task.dependencies_completed !== false
      }));
      
      console.log("Setting processed tasks:", processedTasks.length);
      setTasks(processedTasks);
    }
  }, [initialTasks]);
  
  // Initialize the view with the task if provided in URL
  useEffect(() => {
    if (initialTaskId) {
      setCurrentTaskId(initialTaskId);
      setIsViewingTask(true);
      
      // Find the task in initialTasks
      const task = initialTasks.find(t => t.id === initialTaskId);
      if (task) {
        setCurrentTask(task);
      } else {
        // If not found, fetch it from the database
        fetchTask(initialTaskId);
      }
    }
  }, [initialTaskId, initialTasks]);
  
  // Fetch tasks immediately on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      await refreshTasks();
    };
    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Fetch a single task by ID
  const fetchTask = async (taskId: string) => {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          subtasks(id, title, completed)
        `)
        .eq("id", taskId)
        .single();
      
      if (error) throw error;
      if (data) {
        // Process task to add computed properties
        const subtasksCount = data.subtasks?.length || 0;
        const completedSubtasksCount = data.subtasks?.filter((st: any) => st.completed)?.length || 0;
        
        // Get assignee information if task is assigned
        let assignee_data = null;
        if (data.assigned_to) {
          const { data: userData, error: userError } = await supabase
            .from("users")
            .select("id, email, name, avatar_url")
            .eq("id", data.assigned_to)
            .single();
            
          if (!userError && userData) {
            assignee_data = {
              id: userData.id,
              email: userData.email,
              name: userData.name || null,
              avatar_url: userData.avatar_url || null
            };
          }
        }
        
        // Get time entries for the task
        const { data: timeEntries, error: timeError } = await supabase
          .from("time_entries")
          .select(`
            *,
            users:user_id (
              name,
              email,
              avatar_url
            )
          `)
          .eq("task_id", taskId)
          .order("created_at", { ascending: false });
          
        if (timeError) {
          console.error("Error fetching time entries:", timeError);
        }
        
        // Process time entries
        const processedTimeEntries = timeEntries?.map((entry) => ({
          id: entry.id,
          task_id: entry.task_id,
          user_id: entry.user_id,
          hours: entry.hours,
          description: entry.description,
          created_at: entry.created_at,
          user_name: entry.users?.name || "",
          user_email: entry.users?.email || "",
          user_avatar_url: entry.users?.avatar_url || "",
        })) || [];
        
        // Calculate total time spent
        const totalTimeSpent = processedTimeEntries.reduce((sum, entry) => sum + entry.hours, 0);
        
        const processedTask = {
          ...data,
          subtasks_count: subtasksCount,
          completed_subtasks_count: completedSubtasksCount,
          has_dependencies: false,
          dependencies_completed: true,
          assignee_data,
          time_entries: processedTimeEntries,
          time_spent: totalTimeSpent
        };
        
        setCurrentTask(processedTask);
      }
    } catch (error) {
      console.error("Error fetching task:", error);
    }
  };
  
  // Subscribe to task changes
  useEffect(() => {
    const tasksSubscription = supabase
      .channel('tasks_channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
        },
        () => {
          refreshTasks();
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(tasksSubscription);
    };
  }, []);
  
  // Initialize filters and refresh tasks
  useEffect(() => {
    console.log("Initial tasks:", initialTasks.length, initialTasks);
    console.log("Initial team filter:", initialTeamFilter);
    setTeamFilter(initialTeamFilter || null);
    
    // Refresh tasks after component mounts to ensure we have the latest data
    refreshTasks();
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTeamFilter]);
  
  // Refresh tasks when team filter changes
  useEffect(() => {
    console.log("Team filter changed:", teamFilter);
    refreshTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamFilter]);
  
  // Function to refresh tasks from database
  const refreshTasks = async () => {
    try {
      console.log("Refreshing tasks with teamFilter:", teamFilter, "userId:", userId);
      
      // Start with a base query - removing assignee_data relationship
      let query = supabase
        .from("tasks")
        .select(`
          *,
          subtasks(id, title, completed)
        `);
      
      // Filter by team ID if one is selected
      if (teamFilter) {
        query = query.eq("team_id", teamFilter);
      } else {
        // If no team is selected, only show tasks associated with the user
        // Either created by them or assigned to them
        query = query.or(`user_id.eq.${userId},assigned_to.eq.${userId}`);
      }
      
      const { data, error } = await query.order("created_at", { ascending: false });
      
      if (error) {
        console.error("Error fetching tasks:", error);
        return;
      }
      
      console.log("Fetched tasks:", data?.length, data);
      
      if (data && data.length > 0) {
        // Get all dependencies for all tasks
        const { data: dependenciesData, error: dependenciesError } = await supabase
          .from("task_dependencies")
          .select("dependent_task_id, dependency_task_id");
        
        if (dependenciesError) {
          console.error("Error fetching task dependencies:", dependenciesError);
        }
        
        // Organize dependencies by dependent task
        const dependencies: Record<string, string[]> = {};
        dependenciesData?.forEach((dep) => {
          if (!dependencies[dep.dependent_task_id]) {
            dependencies[dep.dependent_task_id] = [];
          }
          dependencies[dep.dependent_task_id].push(dep.dependency_task_id);
        });
        
        // Check status of all dependencies
        const dependencyStatusComplete: Record<string, boolean> = {};
        
        for (const taskId in dependencies) {
          const dependencyIds = dependencies[taskId];
          // Find all dependency tasks
          const dependencyTasks = data.filter(task => 
            dependencyIds.includes(task.id)
          );
          
          // Task dependencies are complete if all dependency tasks are "done"
          dependencyStatusComplete[taskId] = dependencyTasks.every(
            task => task.status === "done"
          );
        }
        
        // Get user information for assigned tasks
        const assignedTaskIds = data
          .filter(task => task.assigned_to)
          .map(task => task.assigned_to);
          
        let userMap: Record<string, any> = {};
        
        if (assignedTaskIds.length > 0) {
          const { data: assignedUsers } = await supabase
            .from("users")
            .select("id, email, name, avatar_url")
            .in("id", assignedTaskIds);
            
          if (assignedUsers) {
            userMap = assignedUsers.reduce((acc, user) => {
              acc[user.id] = user;
              return acc;
            }, {} as Record<string, any>);
          }
        }

        // Process tasks to add computed properties
        const processedTasks = data.map(task => {
          // Count completed subtasks
          const subtasksCount = task.subtasks?.length || 0;
          const completedSubtasksCount = task.subtasks?.filter((st: any) => st.completed)?.length || 0;
          
          // Create a proper assignee_data from user information if available
          const assignee_data = task.assigned_to && userMap[task.assigned_to] 
            ? {
                id: userMap[task.assigned_to].id,
                email: userMap[task.assigned_to].email,
                name: userMap[task.assigned_to].name || null,
                avatar_url: userMap[task.assigned_to].avatar_url || null
              }
            : null;
          
          // Check if task has dependencies and if they are complete
          const has_dependencies = Boolean(dependencies[task.id]?.length > 0);
          const dependencies_completed = !has_dependencies || dependencyStatusComplete[task.id] || false;
          
          return {
            ...task,
            subtasks_count: subtasksCount,
            completed_subtasks_count: completedSubtasksCount,
            has_dependencies,
            dependencies_completed,
            assignee_data
          };
        });
        
        console.log("Setting tasks:", processedTasks.length);
        setTasks(processedTasks);
        
        // If we're currently viewing a task, update its data
        if (currentTaskId) {
          const updatedTask = processedTasks.find(t => t.id === currentTaskId);
          if (updatedTask) {
            setCurrentTask(updatedTask);
          }
        }
      } else {
        console.log("No tasks found");
        setTasks([]);
      }
    } catch (err) {
      console.error("Error in refreshTasks:", err);
    }
  };
  
  // Function to update task
  const handleTaskUpdate = async (taskId: string, updatedTask: Partial<Task>) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update(updatedTask)
        .eq('id', taskId);
      
      if (error) throw error;
      
      // Optimistic update
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === taskId ? { ...task, ...updatedTask } : task
        )
      );
      
      // Also update currentTask if it's the one being edited
      if (currentTask && currentTask.id === taskId) {
        setCurrentTask(prev => prev ? { ...prev, ...updatedTask } : null);
      }
      
      return Promise.resolve();
    } catch (error) {
      console.error("Error updating task:", error);
      return Promise.reject(error);
    }
  };
  
  // Function to create a new task
  const handleCreateTask = async (status: TaskStatus) => {
    setNewTask({
      ...newTask,
      status,
      team_id: teamFilter
    });
    setIsCreating(true);
  };
  
  // Function to submit new task
  const handleSubmitNewTask = async () => {
    if (!newTask.title.trim()) return;
    
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title: newTask.title,
          description: newTask.description,
          status: newTask.status,
          priority: newTask.priority,
          due_date: newTask.due_date,
          team_id: newTask.team_id,
          assigned_to: newTask.assigned_to,
          user_id: userId
        })
        .select();
      
      if (error) throw error;
      
      // Reset form and close dialog
      setNewTask({
        title: "",
        description: "",
        status: "todo",
        priority: "medium",
        due_date: null,
        team_id: teamFilter,
        assigned_to: null,
      });
      setIsCreating(false);
      
      // Refresh tasks to include the new one
      refreshTasks();
    } catch (error) {
      console.error("Error creating task:", error);
    }
  };
  
  // Function to handle team filter change
  const handleTeamFilterChange = (value: string) => {
    setTeamFilter(value === "none" ? null : value);
    
    // Update URL with team parameter
    const params = new URLSearchParams(searchParams.toString());
    if (value === "none") {
      params.delete("team");
    } else {
      params.set("team", value);
    }
    
    router.push(`/dashboard/kanban?${params.toString()}`);
  };
  
  // Function to handle task click
  const handleTaskClick = (taskId: string) => {
    // Find the clicked task
    const task = tasks.find(t => t.id === taskId);
    setCurrentTask(task || null);
    setCurrentTaskId(taskId);
    setIsViewingTask(true);
    
    // Update URL with taskId parameter
    const params = new URLSearchParams(searchParams.toString());
    params.set("taskId", taskId);
    if (teamFilter) {
      params.set("team", teamFilter);
    }
    
    router.push(`/dashboard/kanban?${params.toString()}`);
  };
  
  // Function to close task view
  const handleCloseTaskView = () => {
    setIsViewingTask(false);
    setCurrentTaskId(null);
    setCurrentTask(null);
    
    // Remove taskId from URL
    const params = new URLSearchParams(searchParams.toString());
    params.delete("taskId");
    
    router.push(`/dashboard/kanban?${params.toString()}`);
  };
  
  // Function to handle editing a task
  const handleEditTask = (taskId: string) => {
    // Find the task to edit
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setEditTask(task);
      setIsEditing(true);
    }
  };
  
  // Function to submit edited task
  const handleSubmitEditedTask = async () => {
    if (!editTask || !editTask.title.trim()) return;
    
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: editTask.title,
          description: editTask.description,
          status: editTask.status,
          priority: editTask.priority,
          due_date: editTask.due_date,
          team_id: editTask.team_id,
          assigned_to: editTask.assigned_to,
        })
        .eq('id', editTask.id);
      
      if (error) throw error;
      
      // Close dialog and refresh tasks
      setIsEditing(false);
      setEditTask(null);
      
      // Refresh tasks to include the edited one
      refreshTasks();
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };
  
  return (
    <div className="flex flex-col gap-6">
      {/* Team Filter */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <label className="text-sm font-medium whitespace-nowrap">Team:</label>
          <Select value={teamFilter || "none"} onValueChange={handleTeamFilterChange}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Select team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">All Tasks</SelectItem>
              {userTeams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <Button onClick={() => handleCreateTask("todo")} className="flex items-center gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Add Task
        </Button>
      </div>
      
      {/* Kanban Board */}
      {!Array.isArray(tasks) || tasks.length === 0 ? (
        <div className="text-center py-8 bg-secondary/50 rounded-xl">
          <p className="text-muted-foreground">No tasks found. Create a new task to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="min-w-[768px] w-full">
            <KanbanBoard 
              tasks={tasks} 
              onTaskUpdate={handleTaskUpdate}
              onTaskClick={handleTaskClick}
              onAddTask={handleCreateTask}
              onEdit={handleEditTask}
              teamId={teamFilter}
            />
          </div>
        </div>
      )}
      
      {/* New Task Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-task-title">Title</Label>
              <Input 
                id="new-task-title"
                value={newTask.title} 
                onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                placeholder="Task title"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-task-description">Description (optional)</Label>
              <Input 
                id="new-task-description"
                value={newTask.description || ""} 
                onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                placeholder="Task description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-task-status">Status</Label>
                <Select 
                  value={newTask.status} 
                  onValueChange={(value) => setNewTask({...newTask, status: value as TaskStatus})}
                >
                  <SelectTrigger id="new-task-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-task-priority">Priority</Label>
                <Select 
                  value={newTask.priority} 
                  onValueChange={(value) => setNewTask({...newTask, priority: value})}
                >
                  <SelectTrigger id="new-task-priority">
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
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-task-due-date">Due Date (optional)</Label>
              <Input
                id="new-task-due-date"
                type="datetime-local"
                value={newTask.due_date || ""}
                onChange={(e) => setNewTask({...newTask, due_date: e.target.value})}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="team-create">Team</Label>
              <TeamSelector
                teams={userTeams || []}
                value={newTask.team_id || null}
                onChange={(value) => 
                  setNewTask({ ...newTask, team_id: value })
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="assigned-to-create">Assigned To</Label>
              <UserAssignmentSelector
                teamId={newTask.team_id || null}
                value={newTask.assigned_to || null}
                onChange={(value) => 
                  setNewTask({ ...newTask, assigned_to: value })
                }
              />
            </div>
            <Button
              onClick={handleSubmitNewTask}
              className="bg-primary text-white w-full"
            >
              Create Task
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Edit Task Dialog */}
      {editTask && (
        <Dialog open={isEditing} onOpenChange={setIsEditing}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Task</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-task-title">Title</Label>
                <Input 
                  id="edit-task-title"
                  value={editTask.title} 
                  onChange={(e) => setEditTask({...editTask, title: e.target.value})}
                  placeholder="Task title"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-task-description">Description (optional)</Label>
                <Input 
                  id="edit-task-description"
                  value={editTask.description || ""} 
                  onChange={(e) => setEditTask({...editTask, description: e.target.value})}
                  placeholder="Task description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-task-status">Status</Label>
                  <Select 
                    value={editTask.status} 
                    onValueChange={(value) => setEditTask({...editTask, status: value as TaskStatus})}
                  >
                    <SelectTrigger id="edit-task-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">To Do</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-task-priority">Priority</Label>
                  <Select 
                    value={editTask.priority || "medium"} 
                    onValueChange={(value) => setEditTask({...editTask, priority: value as any})}
                  >
                    <SelectTrigger id="edit-task-priority">
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
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-task-due-date">Due Date (optional)</Label>
                <Input
                  id="edit-task-due-date"
                  type="datetime-local"
                  value={editTask.due_date || ""}
                  onChange={(e) => setEditTask({...editTask, due_date: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="team">Team</Label>
                <TeamSelector
                  teams={userTeams || []}
                  value={editTask.team_id || null}
                  onChange={(value) => setEditTask({ ...editTask, team_id: value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="assigned-to">Assigned To</Label>
                <UserAssignmentSelector
                  teamId={editTask.team_id || null}
                  value={editTask.assigned_to || null}
                  onChange={(value) => setEditTask({ ...editTask, assigned_to: value })}
                />
              </div>
              
              {/* Task Dependencies Section */}
              <div className="mt-6 space-y-4">
                <div className="space-y-2">
                  <h3 className="text-md font-medium">Task Dependencies</h3>
                  <p className="text-sm text-muted-foreground">
                    Tasks that must be completed before this task can be started
                  </p>
                  <TaskDependencySelector 
                    taskId={editTask.id}
                    userId={userId}
                    onDependenciesChange={() => {
                      refreshTasks();
                    }}
                  />
                </div>
              </div>
              
              {/* Subtasks Section */}
              <div className="mt-6 space-y-4">
                <div className="space-y-2">
                  <h3 className="text-md font-medium">Subtasks</h3>
                  <p className="text-sm text-muted-foreground">
                    Break down this task into smaller steps
                  </p>
                  <SubtaskList 
                    taskId={editTask.id}
                    userId={userId}
                    onSubtasksChange={() => {
                      refreshTasks();
                    }}
                  />
                </div>
              </div>
              
              {/* Update Button at the end */}
              <div className="mt-8">
                <Button 
                  onClick={handleSubmitEditedTask}
                  className="bg-primary text-white w-full"
                >
                  Update Task
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
      
      {/* Task View Dialog */}
      {currentTask && (
        <Dialog open={isViewingTask} onOpenChange={setIsViewingTask}>
          <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
            <TaskViewCard 
              task={currentTask}
              isOpen={isViewingTask}
              onClose={handleCloseTaskView}
              onSubtasksChange={refreshTasks}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
} 