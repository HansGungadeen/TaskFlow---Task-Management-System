"use client";

import { useState, useEffect } from "react";
import { 
  DragDropContext, 
  Droppable, 
  Draggable, 
  DropResult, 
  DroppableProvided, 
  DraggableProvided, 
  DroppableStateSnapshot,
  DraggableStateSnapshot
} from "@hello-pangea/dnd";
import { createClient } from "@/utils/utils";
import { Task, TaskStatus } from "@/types/tasks";
import { Edit, Plus } from "lucide-react";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import TaskHistory from "./task-history";

// Define the column types that match our task statuses
const columns: {id: TaskStatus, title: string}[] = [
  { id: "todo", title: "To Do" },
  { id: "in_progress", title: "In Progress" },
  { id: "done", title: "Done" }
];

interface KanbanBoardProps {
  tasks: Task[];
  onTaskUpdate: (taskId: string, updatedTask: Partial<Task>) => Promise<void>;
  onTaskClick: (taskId: string) => void;
  onAddTask?: (status: TaskStatus) => void;
  onEdit?: (taskId: string) => void;
  teamId?: string | null;
}

export default function KanbanBoard({ 
  tasks, 
  onTaskUpdate, 
  onTaskClick,
  onAddTask,
  onEdit,
  teamId
}: KanbanBoardProps) {
  // Debug log tasks right at component entry
  console.log('DIRECT PROP CHECK KanbanBoard tasks:', 
    Array.isArray(tasks) ? tasks.length : 'not an array',
    JSON.stringify(tasks?.slice(0, 2)),
    'teamId:', teamId);
  
  const [tasksByStatus, setTasksByStatus] = useState<Record<TaskStatus, Task[]>>({
    todo: [],
    in_progress: [],
    done: []
  });
  
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  
  // Debug log on mount
  useEffect(() => {
    console.log("Kanban Board mounted with:", {
      tasksCount: tasks?.length || 0,
      teamId
    });
    // No need to process tasks again as we have the tasks useEffect
  }, []);
  
  // Process tasks when tasks prop changes
  useEffect(() => {
    console.log("KanbanBoard: processing tasks", tasks?.length || 0, JSON.stringify(tasks?.slice(0, 2)));
    
    // Default empty state for tasksByStatus
    const defaultState = {
      todo: [],
      in_progress: [],
      done: []
    };
    
    if (!Array.isArray(tasks) || tasks.length === 0) {
      console.warn("No tasks to display or invalid tasks format");
      setTasksByStatus(defaultState);
      return;
    }

    // Filter by team if teamId is provided
    let filteredTasks = tasks;
    if (teamId) {
      filteredTasks = tasks.filter(task => task.team_id === teamId);
      console.log(`Filtered ${tasks.length} tasks to ${filteredTasks.length} for team ${teamId}`);
    }

    const grouped: Record<string, Task[]> = {
      todo: [],
      in_progress: [],
      done: []
    };

    let validTasks = 0;
    filteredTasks.forEach((task) => {
      if (!task.id) {
        console.warn("Skipping task without ID", task);
        return;
      }
      
      validTasks++;
      
      // Ensure task has a valid status or default to 'todo'
      const status = ['todo', 'in_progress', 'done'].includes(task.status || '') 
        ? task.status 
        : 'todo';
        
      if (!task.status || task.status !== status) {
        console.warn(`Task ${task.id} had invalid status "${task.status}", defaulting to "${status}"`);
      }
      
      // Explicitly assign task to group with the validated status
      grouped[status as keyof typeof grouped].push({
        ...task,
        status: status as any
      });
    });

    // Sort tasks by due date
    Object.keys(grouped).forEach((status) => {
      grouped[status].sort((a, b) => {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });
    });

    console.log(`KanbanBoard: Processed ${validTasks} valid tasks into columns:`, 
      `todo: ${grouped.todo.length}`, 
      `in_progress: ${grouped.in_progress.length}`, 
      `done: ${grouped.done.length}`);
    
    setTasksByStatus(grouped);
  }, [tasks, teamId]);
  
  // Initialize the board with tasks on first load
  useEffect(() => {
    console.log("KanbanBoard: initial mount with tasks:", tasks?.length || 0);
    if (Array.isArray(tasks) && tasks.length > 0) {
      // Initial tasks are already processed in the tasks useEffect
      setTasksLoaded(true);
    }
  }, []);
  
  // Set tasks loaded when tasks change or on filter change
  useEffect(() => {
    // Tasks are processed in the tasks useEffect
    setTasksLoaded(true);
  }, [teamId]);
  
  // Handle drag end event
  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    
    // Drop outside of any droppable area
    if (!destination) return;
    
    // Dropped in the same position
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }
    
    // Find the task that was dragged
    const draggedTask = tasks.find(task => task.id === draggableId);
    if (!draggedTask) return;
    
    // Check if task has unfinished dependencies and trying to mark as done or in progress
    if (
      draggedTask.has_dependencies &&
      !draggedTask.dependencies_completed &&
      (destination.droppableId === "done" || destination.droppableId === "in_progress") &&
      source.droppableId === "todo"
    ) {
      console.error("Cannot change status: This task has dependencies that are not completed yet.");
      return; // Don't allow the drag
    }
    
    // Create a new task object with the updated status
    const updatedTask = {
      ...draggedTask,
      status: destination.droppableId as TaskStatus
    };
    
    // Set updating state
    setIsUpdating(draggableId);
    
    // Optimistically update the UI
    const newTasksByStatus = { ...tasksByStatus };
    
    // Remove the task from the source column
    newTasksByStatus[source.droppableId as TaskStatus] = 
      newTasksByStatus[source.droppableId as TaskStatus].filter(
        task => task.id !== draggableId
      );
    
    // Add the task to the destination column at the right index
    newTasksByStatus[destination.droppableId as TaskStatus].splice(
      destination.index,
      0,
      updatedTask
    );
    
    setTasksByStatus(newTasksByStatus);
    
    // Update the task in the database
    try {
      await onTaskUpdate(draggableId, { status: destination.droppableId as TaskStatus });
    } catch (error) {
      console.error("Error updating task status:", error);
      // Revert the UI if there was an error
      setTasksByStatus({
        todo: tasks.filter(t => t.status === "todo"),
        in_progress: tasks.filter(t => t.status === "in_progress"),
        done: tasks.filter(t => t.status === "done"),
      });
    } finally {
      setIsUpdating(null);
    }
  };

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case "urgent":
        return "bg-red-500/20 text-red-700 dark:text-red-400";
      case "high":
        return "bg-orange-500/20 text-orange-700 dark:text-orange-400";
      case "medium":
        return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400";
      case "low":
        return "bg-green-500/20 text-green-700 dark:text-green-400";
      default:
        return "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300";
    }
  };
  
  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
        {columns.map((column) => (
          <div key={column.id} className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">{column.title}</h3>
              <Badge variant="outline">
                {tasksByStatus[column.id]?.length || 0}
              </Badge>
            </div>
            <Droppable droppableId={column.id}>
              {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    "flex-1 rounded-lg p-4 min-h-[500px] overflow-y-auto",
                    snapshot.isDraggingOver 
                      ? "bg-secondary/80" 
                      : "bg-secondary/50"
                  )}
                >
                  {tasksByStatus[column.id]?.map((task, index) => (
                    <Draggable 
                      key={task.id} 
                      draggableId={task.id} 
                      index={index}
                    >
                      {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={cn(
                            "bg-card rounded-md shadow-sm p-4 mb-3 border border-border cursor-pointer",
                            snapshot.isDragging ? "shadow-md" : "",
                            isUpdating === task.id ? "opacity-70" : ""
                          )}
                          onClick={() => onTaskClick(task.id)}
                        >
                          <div className="flex flex-col gap-3">
                            <div className="flex justify-between items-start">
                              <h4 className="font-medium line-clamp-2 hover:text-primary max-w-[70%]">
                                {task.title}
                                {isUpdating === task.id && (
                                  <span className="ml-2 inline-block animate-pulse text-xs text-muted-foreground">
                                    Updating...
                                  </span>
                                )}
                              </h4>
                              
                              <div className="flex -mr-2">
                                <div onClick={(e) => e.stopPropagation()}>
                                  <TaskHistory taskId={task.id} taskTitle={task.title} />
                                </div>
                                
                                {onEdit && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onEdit(task.id);
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            
                            {task.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {task.description}
                              </p>
                            )}
                            
                            {/* Subtasks progress bar */}
                            {task.subtasks_count && task.subtasks_count > 0 && (
                              <div className="mt-2 mb-1">
                                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                  <span>Subtasks</span>
                                  <span>{task.completed_subtasks_count || 0}/{task.subtasks_count}</span>
                                </div>
                                <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                                  <div 
                                    className="bg-primary h-full rounded-full transition-all" 
                                    style={{ 
                                      width: `${((task.completed_subtasks_count || 0) / Math.max(1, task.subtasks_count)) * 100}%` 
                                    }}
                                  />
                                </div>
                              </div>
                            )}
                            
                            {/* Dependencies warning */}
                            {task.has_dependencies && !task.dependencies_completed && (
                              <div className="mt-1 text-xs text-amber-600 dark:text-amber-400 flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <span>Blocked by dependencies</span>
                              </div>
                            )}
                            
                            <div className="flex justify-between items-center mt-1">
                              <div className="flex items-center gap-2">
                                {task.priority && (
                                  <Badge variant="secondary" className={cn("text-xs", getPriorityColor(task.priority))}>
                                    {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                                  </Badge>
                                )}
                                
                                {task.due_date && (
                                  <Badge variant="outline" className="text-xs">
                                    {formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}
                                  </Badge>
                                )}
                                
                                {task.subtasks_count && task.subtasks_count > 0 && (
                                  <Badge variant="outline" className="text-xs flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                                      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                                      <path d="M9 14l2 2 4-4"></path>
                                    </svg>
                                    <span>{task.completed_subtasks_count || 0}/{task.subtasks_count}</span>
                                  </Badge>
                                )}
                              </div>
                              
                              {task.assignee_data && (
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={task.assignee_data.avatar_url || ""} alt={task.assignee_data.name || task.assignee_data.email || "User"} />
                                  <AvatarFallback>
                                    {task.assignee_data.name 
                                      ? task.assignee_data.name.charAt(0).toUpperCase() 
                                      : (task.assignee_data.email && task.assignee_data.email.length > 0)
                                        ? task.assignee_data.email.charAt(0).toUpperCase()
                                        : "U"}
                                  </AvatarFallback>
                                </Avatar>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                  
                  {onAddTask && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full mt-2 text-muted-foreground hover:text-foreground"
                      onClick={() => onAddTask(column.id)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add task
                    </Button>
                  )}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
} 