"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/utils";
import { Task } from "@/types/tasks";
import { Clock, CheckCircle, Calendar, User, AlertTriangle } from "lucide-react";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { cn } from "@/lib/utils";
import { format, isBefore } from "date-fns";
import TaskViewCard from "./task-view-card";
import { Button } from "./ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface MiniTeamTasksProps {
  tasks: Task[];
  teamId: string | null;
  userId?: string;
  maxTasks?: number;
}

export default function MiniTeamTasks({ 
  tasks, 
  teamId, 
  userId,
  maxTasks = 5
}: MiniTeamTasksProps) {
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<'all' | 'todo' | 'in_progress' | 'done'>('all');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isClient, setIsClient] = useState(false);
  const supabase = createClient();

  // Set initial filtered tasks based on teamId
  useEffect(() => {
    setIsClient(true);
    
    if (!teamId) {
      setFilteredTasks([]);
      return;
    }
    
    const teamTasks = tasks.filter(task => task.team_id === teamId);
    
    // Sort tasks: overdue first, then by due date, then by status
    const sorted = [...teamTasks].sort((a, b) => {
      // First priority - overdue tasks
      const aOverdue = a.due_date && isBefore(new Date(a.due_date), new Date());
      const bOverdue = b.due_date && isBefore(new Date(b.due_date), new Date());
      
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      
      // Second priority - status (todo, then in_progress, then done)
      const statusPriority = { todo: 0, in_progress: 1, done: 2 };
      const aStatus = statusPriority[a.status as keyof typeof statusPriority] || 0;
      const bStatus = statusPriority[b.status as keyof typeof statusPriority] || 0;
      
      if (aStatus !== bStatus) return aStatus - bStatus;
      
      // Third priority - due date (sooner first)
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      
      // Tasks with due dates come before tasks without
      if (a.due_date && !b.due_date) return -1;
      if (!a.due_date && b.due_date) return 1;
      
      // Finally, sort by creation date
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    
    setFilteredTasks(sorted);
  }, [teamId, tasks]);

  // Subscribe to task changes in real-time
  useEffect(() => {
    if (!teamId) return;
    
    // Set up subscription for realtime updates
    const tasksSubscription = supabase
      .channel('mini_team_tasks_channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `team_id=eq.${teamId}`,
        },
        async () => {
          console.log("Real-time update detected for team tasks");
          
          // Fetch updated tasks for this team
          const { data: updatedTasks, error } = await supabase
            .from('tasks')
            .select(`
              *,
              subtasks (
                id,
                title,
                completed
              )
            `)
            .eq('team_id', teamId)
            .order('created_at', { ascending: false });
            
          if (error) {
            console.error("Error fetching updated team tasks:", error);
            return;
          }
          
          if (!updatedTasks || updatedTasks.length === 0) {
            setFilteredTasks([]);
            return;
          }
          
          // Get assignee data for assigned tasks
          const assignedTaskIds = updatedTasks
            .filter(task => task.assigned_to)
            .map(task => task.assigned_to);
            
          let assigneeData: Record<string, any> = {};
            
          if (assignedTaskIds.length > 0) {
            const { data: assignees } = await supabase
              .from('users')
              .select('id, email, name, avatar_url')
              .in('id', assignedTaskIds as string[]);
              
            if (assignees) {
              assigneeData = assignees.reduce((acc, user) => {
                acc[user.id] = user;
                return acc;
              }, {} as Record<string, any>);
            }
          }
          
          // Process the tasks with computed properties
          const processedTasks = updatedTasks.map(task => {
            // Count completed subtasks
            const subtasksCount = task.subtasks?.length || 0;
            const completedSubtasksCount = task.subtasks?.filter((st: any) => st.completed)?.length || 0;
            
            // Add assignee data if available
            const assignee_data = task.assigned_to && assigneeData[task.assigned_to] 
              ? {
                  id: assigneeData[task.assigned_to].id,
                  email: assigneeData[task.assigned_to].email,
                  name: assigneeData[task.assigned_to].name || null,
                  avatar_url: assigneeData[task.assigned_to].avatar_url || null
                }
              : null;
              
            return {
              ...task,
              subtasks_count: subtasksCount,
              completed_subtasks_count: completedSubtasksCount,
              assignee_data
            };
          });
            
          // Sort tasks by the same logic as in the initial load
          const sorted = [...processedTasks].sort((a, b) => {
            // First priority - overdue tasks
            const aOverdue = a.due_date && isBefore(new Date(a.due_date), new Date());
            const bOverdue = b.due_date && isBefore(new Date(b.due_date), new Date());
            
            if (aOverdue && !bOverdue) return -1;
            if (!aOverdue && bOverdue) return 1;
            
            // Second priority - status (todo, then in_progress, then done)
            const statusPriority = { todo: 0, in_progress: 1, done: 2 };
            const aStatus = statusPriority[a.status as keyof typeof statusPriority] || 0;
            const bStatus = statusPriority[b.status as keyof typeof statusPriority] || 0;
            
            if (aStatus !== bStatus) return aStatus - bStatus;
            
            // Third priority - due date (sooner first)
            if (a.due_date && b.due_date) {
              return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
            }
            
            // Tasks with due dates come before tasks without
            if (a.due_date && !b.due_date) return -1;
            if (!a.due_date && b.due_date) return 1;
            
            // Finally, sort by creation date
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
            
          setFilteredTasks(sorted);
          
          // Update selected task if it's currently open
          if (selectedTask) {
            const updatedSelectedTask = processedTasks.find(t => t.id === selectedTask.id);
            if (updatedSelectedTask) {
              setSelectedTask(updatedSelectedTask);
            }
          }
        }
      )
      .subscribe();
      
    // Clean up subscription on unmount or when teamId changes
    return () => {
      supabase.removeChannel(tasksSubscription);
    };
  }, [teamId, supabase, selectedTask]);

  // Apply filter
  const displayTasks = filter === 'all' 
    ? filteredTasks 
    : filteredTasks.filter(task => task.status === filter);

  // Handle task status update
  const handleStatusChange = async (taskId: string, newStatus: 'todo' | 'in_progress' | 'done') => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId);
        
      if (error) throw error;
      
      // Update local state
      setFilteredTasks(prev => 
        prev.map(task => 
          task.id === taskId ? { ...task, status: newStatus } : task
        )
      );
      
      // Update selected task if open
      if (selectedTask && selectedTask.id === taskId) {
        setSelectedTask({ ...selectedTask, status: newStatus });
      }
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  if (!isClient) {
    return <div className="h-full flex items-center justify-center">Loading tasks...</div>;
  }

  if (!teamId || filteredTasks.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
        <AlertTriangle className="h-10 w-10 mb-2 opacity-20" />
        <p className="text-sm">No team tasks available</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Filter Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          <Button 
            variant={filter === 'all' ? "default" : "outline"} 
            size="sm" 
            onClick={() => setFilter('all')}
            className="text-xs h-7 px-2"
          >
            All
          </Button>
          <Button 
            variant={filter === 'todo' ? "default" : "outline"} 
            size="sm" 
            onClick={() => setFilter('todo')}
            className="text-xs h-7 px-2"
          >
            To Do
          </Button>
          <Button 
            variant={filter === 'in_progress' ? "default" : "outline"} 
            size="sm" 
            onClick={() => setFilter('in_progress')}
            className="text-xs h-7 px-2"
          >
            In Progress
          </Button>
          <Button 
            variant={filter === 'done' ? "default" : "outline"} 
            size="sm" 
            onClick={() => setFilter('done')}
            className="text-xs h-7 px-2"
          >
            Done
          </Button>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-2 mb-2">
        {displayTasks.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No {filter !== 'all' ? filter.replace('_', ' ') : ''} tasks to display
          </div>
        ) : (
          displayTasks.slice(0, maxTasks).map((task) => {
            const isOverdue = task.due_date && 
              isBefore(new Date(task.due_date), new Date()) && 
              task.status !== 'done';
              
            return (
              <div 
                key={task.id} 
                className={cn(
                  "p-3 border rounded-md hover:bg-accent/10 transition-colors cursor-pointer",
                  isOverdue && "border-red-400 dark:border-red-800"
                )}
                onClick={() => setSelectedTask(task)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5">
                      {task.status === 'todo' ? (
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      ) : task.status === 'in_progress' ? (
                        <Clock className="h-4 w-4 text-yellow-500" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-medium line-clamp-1">{task.title}</h3>
                      {task.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {task.description}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 px-2">
                        <Badge className={cn(
                          "text-[10px] px-1 py-0",
                          task.status === 'todo' ? "bg-gray-100 text-gray-800 hover:bg-gray-200" :
                          task.status === 'in_progress' ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200" :
                          "bg-green-100 text-green-800 hover:bg-green-200"
                        )}>
                          {task.status === 'todo' ? 'To Do' : 
                           task.status === 'in_progress' ? 'In Progress' : 'Done'}
                        </Badge>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        handleStatusChange(task.id, 'todo');
                      }}>
                        <Clock className="h-4 w-4 mr-2" /> To Do
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        handleStatusChange(task.id, 'in_progress');
                      }}>
                        <Clock className="h-4 w-4 mr-2 text-yellow-500" /> In Progress
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        handleStatusChange(task.id, 'done');
                      }}>
                        <CheckCircle className="h-4 w-4 mr-2 text-green-500" /> Done
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  {task.due_date && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span className={cn(
                            isOverdue && "text-red-500 font-medium"
                          )}>
                            {format(new Date(task.due_date), "MMM d")}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Due: {format(new Date(task.due_date), "MMMM d, yyyy")}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  
                  {task.assignee_data && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1">
                          <Avatar className="h-4 w-4">
                            <AvatarImage src={task.assignee_data.avatar_url || ""} />
                            <AvatarFallback className="text-[8px]">
                              {task.assignee_data.name 
                                ? task.assignee_data.name.substring(0, 2).toUpperCase() 
                                : task.assignee_data.email.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span>
                            {task.assignee_data.name 
                              ? task.assignee_data.name 
                              : task.assignee_data.email}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Assigned to: {task.assignee_data.name || task.assignee_data.email}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
            );
          })
        )}
        
        {displayTasks.length > maxTasks && (
          <div className="text-center text-xs text-muted-foreground pt-1">
            +{displayTasks.length - maxTasks} more tasks
          </div>
        )}
      </div>
      
      {/* Task Detail View */}
      {selectedTask && (
        <TaskViewCard
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onSubtasksChange={() => {
            // Refresh task data if needed
          }}
        />
      )}
    </div>
  );
} 