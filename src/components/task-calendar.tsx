"use client";

import { useState, useEffect, useMemo } from "react";
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
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Plus,
  CheckCircle,
  Clock,
  AlertTriangle,
  UserCircle,
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
import { useRouter, useSearchParams } from "next/navigation";
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
import TaskViewCard from "./task-view-card";
import { format, addDays, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";

type Team = {
  id: string;
  name: string;
};

type TaskCalendarProps = {
  initialTasks: TaskType[];
  userTeams?: Team[];
  userId?: string;
  initialTeamFilter?: string | null;
  initialTaskId?: string;
  initialDate?: Date;
};

export default function TaskCalendar({ 
  initialTasks, 
  userTeams = [], 
  userId,
  initialTeamFilter,
  initialTaskId,
  initialDate
}: TaskCalendarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tasks, setTasks] = useState<TaskType[]>(initialTasks);
  const [filteredTasks, setFilteredTasks] = useState<TaskType[]>(initialTasks);
  const [currentDate, setCurrentDate] = useState<Date>(initialDate || new Date());
  const [currentView, setCurrentView] = useState<'month' | 'week'>('month');
  const [teamFilter, setTeamFilter] = useState<string | null>(initialTeamFilter || null);
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskType | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    status: "todo" as TaskStatus,
    priority: "medium" as TaskPriority,
    due_date: format(new Date(), "yyyy-MM-dd"),
    team_id: null as string | null,
    assigned_to: null as string | null,
  });
  const [isClient, setIsClient] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<Record<string, AssigneeData[]>>({});
  const { theme } = useTheme();

  const supabase = createClient();

  // Set isClient to true once component mounts and fetch user data
  useEffect(() => {
    setIsClient(true);

    const fetchUserData = async () => {
      const { data } = await supabase.auth.getUser();
      setUserData(data);
    };

    fetchUserData();
    
    // If there's an initialTaskId, find that task and open it
    if (initialTaskId) {
      const foundTask = initialTasks.find(task => task.id === initialTaskId);
      if (foundTask) {
        setSelectedTask(foundTask);
        setIsTaskModalOpen(true);
      }
    }
    
    // Set up real-time subscriptions for tasks
    const tasksSubscription = supabase
      .channel('calendar-tasks')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        async (payload) => {
          console.log('Calendar received task change:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newTask = payload.new as TaskType;
            setTasks(prevTasks => [newTask, ...prevTasks]);
          } 
          else if (payload.eventType === 'UPDATE') {
            const updatedTask = payload.new as TaskType;
            setTasks(prevTasks => 
              prevTasks.map(task => 
                task.id === updatedTask.id ? { ...task, ...updatedTask } : task
              )
            );
            
            // If this task is currently selected, update it
            if (selectedTask && selectedTask.id === updatedTask.id) {
              setSelectedTask(prev => prev ? { ...prev, ...updatedTask } : prev);
            }
          } 
          else if (payload.eventType === 'DELETE') {
            const deletedTaskId = payload.old.id;
            setTasks(prevTasks => 
              prevTasks.filter(task => task.id !== deletedTaskId)
            );
            
            // If this task is currently selected, close the modal
            if (selectedTask && selectedTask.id === deletedTaskId) {
              setIsTaskModalOpen(false);
              setSelectedTask(null);
            }
          }
        }
      )
      .subscribe();
      
    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(tasksSubscription);
    };
  }, [initialTaskId, initialTasks, supabase]);

  // Filter tasks when teamFilter changes
  useEffect(() => {
    let filtered = [...tasks];
    
    if (teamFilter) {
      filtered = filtered.filter(task => task.team_id === teamFilter);
    }
    
    if (assigneeFilter) {
      filtered = filtered.filter(task => task.assigned_to === assigneeFilter);
    }
    
    setFilteredTasks(filtered);
  }, [tasks, teamFilter, assigneeFilter]);

  // Compute calendar days based on current date and view
  const calendarDays = useMemo(() => {
    if (currentView === 'month') {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const startDate = startOfWeek(monthStart);
      const endDate = endOfWeek(monthEnd);
      
      return eachDayOfInterval({
        start: startDate,
        end: endDate
      });
    } else { // week view
      const weekStart = startOfWeek(currentDate);
      const weekEnd = endOfWeek(currentDate);
      
      return eachDayOfInterval({
        start: weekStart,
        end: weekEnd
      });
    }
  }, [currentDate, currentView]);

  // Get tasks for a specific day
  const getTasksForDay = (date: Date) => {
    return filteredTasks.filter(task => {
      if (!task.due_date) return false;
      return isSameDay(new Date(task.due_date), date);
    });
  };

  // Format date with ordinal suffix
  const formatDateWithOrdinal = (date: Date) => {
    const day = date.getDate();
    const suffix = ['th', 'st', 'nd', 'rd'][day % 10 > 3 ? 0 : (day % 100 - day % 10 != 10 ? day % 10 : 0)];
    return format(date, "d") + suffix;
  };

  // Navigate to previous period
  const goToPrevious = () => {
    if (currentView === 'month') {
      setCurrentDate(prevDate => subMonths(prevDate, 1));
    } else {
      setCurrentDate(prevDate => subWeeks(prevDate, 1));
    }
  };

  // Navigate to next period
  const goToNext = () => {
    if (currentView === 'month') {
      setCurrentDate(prevDate => addMonths(prevDate, 1));
    } else {
      setCurrentDate(prevDate => addWeeks(prevDate, 1));
    }
  };

  // Navigate to today
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Get user initials from name or email
  const getInitials = (user: AssigneeData | null): string => {
    if (!user) return 'U';
    
    if (user.name) {
      const nameParts = user.name.split(' ');
      if (nameParts.length > 1) {
        return (nameParts[0][0] + nameParts[1][0]).toUpperCase();
      }
      return user.name.substring(0, 2).toUpperCase();
    }
    
    if (user.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    
    return 'U';
  };

  // Handle task selection
  const handleTaskClick = (task: TaskType) => {
    setSelectedTask(task);
    setIsTaskModalOpen(true);
    
    // Update URL with task ID
    const params = new URLSearchParams(searchParams as any);
    params.set('taskId', task.id);
    router.push(`/dashboard/calendar?${params.toString()}`);
  };

  // Priority color mapping
  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case "urgent":
        return "text-red-500 bg-red-100 dark:bg-red-900 dark:bg-opacity-20";
      case "high":
        return "text-orange-500 bg-orange-100 dark:bg-orange-900 dark:bg-opacity-20";
      case "medium":
        return "text-yellow-500 bg-yellow-100 dark:bg-yellow-900 dark:bg-opacity-20";
      case "low":
        return "text-green-500 bg-green-100 dark:bg-green-900 dark:bg-opacity-20";
      default:
        return "text-blue-500 bg-blue-100 dark:bg-blue-900 dark:bg-opacity-20";
    }
  };

  // Background color for task cards based on priority
  const getPriorityBackground = (priority: string | null) => {
    switch (priority) {
      case "urgent":
        return "bg-red-50 border-l-2 border-red-500 dark:bg-red-950 dark:bg-opacity-30";
      case "high":
        return "bg-orange-50 border-l-2 border-orange-500 dark:bg-orange-950 dark:bg-opacity-30";
      case "medium":
        return "bg-yellow-50 border-l-2 border-yellow-500 dark:bg-yellow-950 dark:bg-opacity-30";
      case "low":
        return "bg-green-50 border-l-2 border-green-500 dark:bg-green-950 dark:bg-opacity-30";
      default:
        return "bg-card border-l-2 border-blue-500 dark:border-blue-400";
    }
  };

  // Status icon mapping
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "todo":
        return <Clock className="h-3 w-3" />;
      case "in_progress":
        return <AlertTriangle className="h-3 w-3" />;
      case "done":
        return <CheckCircle className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  // Handle creating a new task
  const handleCreateTask = async () => {
    try {
      if (!userId) return;
      
      const taskDate = new Date(newTask.due_date);
      
      // Handle the team_id properly - if it's "none", set it to null
      const team_id = newTask.team_id === "none" ? null : newTask.team_id;
      
      const { data: task, error } = await supabase
        .from("tasks")
        .insert({
          title: newTask.title,
          description: newTask.description,
          status: newTask.status,
          priority: newTask.priority,
          due_date: taskDate.toISOString(),
          user_id: userId,
          team_id,
          assigned_to: newTask.assigned_to,
        })
        .select()
        .single();

      if (error) throw error;
      
      // Add the new task to the task list
      setTasks(prevTasks => [task, ...prevTasks]);
      
      // Reset form
      setNewTask({
        title: "",
        description: "",
        status: "todo",
        priority: "medium",
        due_date: format(new Date(), "yyyy-MM-dd"),
        team_id: null,
        assigned_to: null,
      });
      
      setIsCreating(false);
    } catch (error) {
      console.error("Error creating task:", error);
    }
  };

  // Handle team filter change
  const handleTeamFilterChange = (teamId: string | null) => {
    setTeamFilter(teamId);
    
    const params = new URLSearchParams(searchParams as any);
    if (teamId) {
      params.set('team', teamId);
    } else {
      params.delete('team');
    }
    router.push(`/dashboard/calendar?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      {/* Calendar Controls - Jira-like header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-2">
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={goToPrevious}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={goToToday}
            className="h-8 px-3 text-xs font-medium"
          >
            Today
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={goToNext}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h3 className="text-xl font-semibold ml-2">
            {format(currentDate, 'MMMM yyyy')}
          </h3>
        </div>
        
        <div className="flex flex-wrap gap-2 items-center">
          <Tabs 
            value={currentView} 
            onValueChange={(v) => setCurrentView(v as 'month' | 'week')}
            className="h-8"
          >
            <TabsList className="h-8 p-1">
              <TabsTrigger value="month" className="text-xs px-3 py-1">Month</TabsTrigger>
              <TabsTrigger value="week" className="text-xs px-3 py-1">Week</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="w-[180px]">
            <TeamSelector 
              teams={userTeams} 
              value={teamFilter} 
              onChange={handleTeamFilterChange} 
            />
          </div>
          
          <Button 
            onClick={() => setIsCreating(true)}
            size="sm"
            className="h-8"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Task
          </Button>
        </div>
      </div>
      
      {/* Jira-like Calendar Grid with shadow and better spacing */}
      <div className="bg-background rounded-md border shadow">
        {/* Day names header - sticky */}
        <div className="grid grid-cols-7 border-b sticky top-0 bg-background z-10">
          {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => (
            <div 
              key={day}
              className={`
                text-center py-2 px-1 text-sm font-medium text-muted-foreground
                ${index < 6 ? 'border-r' : ''}
              `}
            >
              <span className="hidden sm:inline">{day}</span>
              <span className="sm:hidden">{day.substring(0, 3)}</span>
            </div>
          ))}
        </div>
        
        {/* Calendar days grid */}
        <div className={`grid grid-cols-7`}>
          {calendarDays.map((day, index) => {
            const tasksForDay = getTasksForDay(day);
            const isToday = isSameDay(day, new Date());
            const isCurrentMonth = currentView === 'month' ? isSameMonth(day, currentDate) : true;
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            
            return (
              <div 
                key={day.toString()}
                className={`
                  min-h-[120px] p-1 relative
                  ${index < calendarDays.length - 7 ? 'border-b' : ''} 
                  ${index % 7 < 6 ? 'border-r' : ''}
                  ${isToday ? 'bg-primary/5' : isWeekend ? 'bg-secondary/20' : ''}
                  ${!isCurrentMonth ? 'bg-muted/40' : ''}
                `}
              >
                {/* Date number with indicator for today */}
                <div className="flex justify-between items-center mb-1">
                  <span className={`
                    flex items-center justify-center h-6 w-6 rounded-full text-xs font-medium
                    ${isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}
                  `}>
                    {format(day, "d")}
                  </span>
                  
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity" 
                    onClick={() => {
                      setNewTask({
                        ...newTask,
                        due_date: format(day, "yyyy-MM-dd")
                      });
                      setIsCreating(true);
                    }}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                
                {/* Tasks for the day - Jira-like cards */}
                <div className="space-y-1 max-h-[160px] overflow-y-auto scrollbar-thin">
                  {tasksForDay.map((task) => (
                    <TooltipProvider key={task.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div 
                            className={`
                              px-2 py-1 rounded text-xs shadow-sm cursor-pointer
                              transition-colors hover:brightness-95 active:brightness-90
                              ${getPriorityBackground(task.priority)}
                              ${task.status === 'done' ? 'line-through opacity-70' : ''}
                            `}
                            onClick={() => handleTaskClick(task)}
                          >
                            <div className="flex items-center gap-1.5">
                              {getStatusIcon(task.status)}
                              <span className="font-medium line-clamp-1">{task.title}</span>
                            </div>
                            
                            <div className="flex items-center justify-between text-[10px] mt-0.5 text-muted-foreground">
                              <div className="flex items-center gap-1">
                                {task.priority && (
                                  <Badge variant="outline" className="h-4 px-1 text-[9px] font-normal bg-background/50">
                                    {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                                  </Badge>
                                )}
                                
                                {task.subtasks && task.subtasks.length > 0 && (
                                  <span className="flex items-center">
                                    <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
                                    {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}
                                  </span>
                                )}
                              </div>
                              
                              {/* Task card assignee */}
                              {task.assignee_data && task.assignee_data.email && (
                                <div className="flex items-center opacity-80">
                                  <UserCircle className="h-2.5 w-2.5 mr-0.5" />
                                  <span className="truncate max-w-[60px]">
                                    {task.assignee_data.name 
                                      ? task.assignee_data.name.split(' ')[0] 
                                      : task.assignee_data.email.split('@')[0]}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[300px] p-3">
                          <div className="space-y-2">
                            <div className="font-medium">{task.title}</div>
                            {task.description && (
                              <div className="text-xs text-muted-foreground line-clamp-2">{task.description}</div>
                            )}
                            <div className="flex flex-wrap gap-1.5 text-xs">
                              <Badge variant="outline" className={getPriorityColor(task.priority)}>
                                {task.priority 
                                  ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) 
                                  : 'Medium'}
                              </Badge>
                              <Badge variant="outline">
                                {task.status === 'todo' ? 'To Do' : 
                                task.status === 'in_progress' ? 'In Progress' : 'Done'}
                              </Badge>
                              {task.subtasks && task.subtasks.length > 0 && (
                                <Badge variant="outline">
                                  Subtasks: {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}
                                </Badge>
                              )}
                            </div>
                            {task.assignee_data && task.assignee_data.email && (
                              <div className="flex items-center opacity-80">
                                <UserCircle className="h-2.5 w-2.5 mr-0.5" />
                                <span className="truncate max-w-[60px]">
                                  {task.assignee_data.name 
                                    ? task.assignee_data.name.split(' ')[0] 
                                    : task.assignee_data.email.split('@')[0]}
                                </span>
                              </div>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Task Creation Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create a new task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="Task title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newTask.description || ""}
                onChange={(e) =>
                  setNewTask({ ...newTask, description: e.target.value })
                }
                placeholder="Task description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={newTask.status}
                  onValueChange={(value) =>
                    setNewTask({ ...newTask, status: value as TaskStatus })
                  }
                >
                  <SelectTrigger id="status">
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
                  value={newTask.priority || "medium"}
                  onValueChange={(value) =>
                    setNewTask({ ...newTask, priority: value as TaskPriority })
                  }
                >
                  <SelectTrigger id="priority">
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
            <div className="space-y-2">
              <Label htmlFor="due-date">Due Date</Label>
              <Input
                id="due-date"
                type="date"
                value={newTask.due_date || ""}
                onChange={(e) =>
                  setNewTask({ ...newTask, due_date: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="team">Team (Optional)</Label>
              <Select
                value={newTask.team_id || undefined}
                onValueChange={(value) =>
                  setNewTask({ ...newTask, team_id: value || null })
                }
              >
                <SelectTrigger id="team">
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Team</SelectItem>
                  {userTeams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {newTask.team_id && newTask.team_id !== "none" && (
              <div className="space-y-2">
                <Label htmlFor="assigned-to">Assign To (Optional)</Label>
                <UserAssignmentSelector 
                  teamId={newTask.team_id}
                  value={newTask.assigned_to}
                  onChange={(value) => setNewTask({ ...newTask, assigned_to: value })}
                />
              </div>
            )}
          </div>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setIsCreating(false)}>
              Cancel
            </Button>
            <Button 
              disabled={!newTask.title}
              onClick={handleCreateTask}
            >
              Create Task
            </Button>
          </CardFooter>
        </DialogContent>
      </Dialog>
      
      {/* Task View Dialog */}
      <TaskViewCard 
        task={selectedTask}
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setSelectedTask(null);
          
          // Remove taskId from URL
          const params = new URLSearchParams(searchParams as any);
          params.delete('taskId');
          router.push(`/dashboard/calendar?${params.toString()}`);
        }}
        onSubtasksChange={() => {
          // Refresh tasks after subtask change
          // In a real app, you would only update the affected task
          // For simplicity, we're refreshing all tasks
        }}
      />
    </div>
  );
} 