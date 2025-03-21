"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { History, ChevronDown, ChevronUp, Filter } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { Badge } from "./ui/badge";
import { format, parseISO } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Skeleton } from "./ui/skeleton";

type TaskHistoryEntry = {
  id: string;
  task_id: string;
  user_id: string;
  action_type: "create" | "update" | "delete";
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  assigned_to: string | null;
  change_type: string | null;
  assignee_data?: {
    name?: string | null;
    email?: string | null;
  } | null;
  user?: {
    name: string | null;
    full_name: string | null;
    email: string | null;
  };
};

type TaskHistoryProps = {
  taskId: string;
  taskTitle: string;
};

export default function TaskHistory({ taskId, taskTitle }: TaskHistoryProps) {
  const [history, setHistory] = useState<TaskHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const supabase = createClient();
  const supabaseRef = useRef(supabase);

  const fetchHistory = useRef(async () => {
    console.log("Fetching task history for task:", taskId);
    setLoading(true);
    try {
      // Fetch task history
      const { data, error } = await supabaseRef.current
        .from("task_history")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: sortDirection === "asc" });

      if (error) throw error;
      
      if (data && data.length > 0) {
        // Get user IDs for entries created by users
        const userIds = data
          .map((entry) => entry.user_id)
          .filter((id, index, self) => self.indexOf(id) === index);
        
        // Get assigned user IDs - check both assigned_to and new_value fields for assignment entries
        const assigneeIds = data
          .filter(entry => 
            (entry.change_type === 'assignment' && entry.assigned_to) || 
            (entry.field_name === 'assigned_to' && entry.new_value))
          .map(entry => entry.assigned_to || entry.new_value)
          .filter((id, index, self) => 
            id && typeof id === 'string' && 
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) && 
            self.indexOf(id) === index
          ) as string[];
        
        console.log("Assignee IDs to fetch:", assigneeIds);
        
        // Fetch user data
        const { data: userData, error: userError } = await supabaseRef.current
          .from("users")
          .select("id, name, full_name, email")
          .in("id", userIds);

        // Fetch assignee data
        let assigneeData: any[] = [];
        if (assigneeIds.length > 0) {
          const { data: assignees, error: assigneeError } = await supabaseRef.current
            .from("users")
            .select("id, name, full_name, email")
            .in("id", assigneeIds);
          
          if (!assigneeError && assignees) {
            assigneeData = assignees;
            console.log("Fetched assignee data:", assignees);
          }
        }

        if (!userError && userData) {
          // Add user information to each history entry
          data.forEach((entry) => {
            // Set user who made the change
            entry.user = userData.find((user) => user.id === entry.user_id) || null;
            
            // For assignment entries, set assignee data
            if (entry.change_type === 'assignment' && entry.assigned_to) {
              const assignee = assigneeData.find(user => user.id === entry.assigned_to);
              if (assignee) {
                entry.assignee_data = {
                  name: assignee.full_name || assignee.name,
                  email: assignee.email
                };
              }
            } 
            // Also handle regular field updates to assigned_to
            else if (entry.field_name === 'assigned_to' && entry.new_value) {
              const assignee = assigneeData.find(user => user.id === entry.new_value);
              if (assignee) {
                entry.assignee_data = {
                  name: assignee.full_name || assignee.name,
                  email: assignee.email
                };
              }
            }
          });
        }
      }

      console.log("Task history data received:", data);
      setHistory(data || []);
    } catch (error) {
      console.error("Error fetching task history:", error);
    } finally {
      setLoading(false);
    }
  }).current;

  useEffect(() => {
    if (open) {
      fetchHistory();
    }
  }, [open, sortDirection, taskId, fetchHistory]);

  const formatValue = (value: string | null): string | React.ReactNode => {
    if (value === null) return "None";
    if (value === "") return "Empty";

    // Check if it's a UUID (likely a user ID from assigned_to field)
    if (value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      return "User ID: " + value.substring(0, 8) + "...";
    }

    // Check if it's a JSON string
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === "object") {
        return (
          <div className="space-y-1">
            {Object.entries(parsed).map(([key, val]) => (
              <div key={key} className="text-xs">
                <span className="font-medium">{key}:</span>{" "}
                {val !== null ? String(val) : "None"}
              </div>
            ))}
          </div>
        );
      }
    } catch (e) {
      // Not JSON, continue with normal formatting
    }

    // Format date strings
    if (value && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      try {
        return format(parseISO(value), "PPp"); // Format as "Apr 29, 2023, 1:30 PM"
      } catch (e) {
        // If parsing fails, return the original value
        return value;
      }
    }

    return value;
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "create":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "update":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "delete":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const getFieldLabel = (field: string | null) => {
    if (!field) return "Unknown Field";
    
    switch (field) {
      case "title":
        return "Title";
      case "description":
        return "Description";
      case "status":
        return "Status";
      case "priority":
        return "Priority";
      case "due_date":
        return "Due Date";
      case "task":
        return "Task";
      case "assigned_to":
        return "Assigned To";
      case "change_type":
        return "Change Type";
      default:
        return field.charAt(0).toUpperCase() + field.slice(1);
    }
  };

  const getUserName = (entry: TaskHistoryEntry) => {
    if (!entry.user) {
      // If we couldn't fetch user info, just show the user ID
      return entry.user_id
        ? `User ${entry.user_id.substring(0, 8)}...`
        : "Unknown User";
    }
    return (
      entry.user.full_name ||
      entry.user.name ||
      entry.user.email ||
      "Unknown User"
    );
  };

  const filteredHistory = filter
    ? history.filter((entry) => entry.field_name === filter)
    : history;

  // Get unique fields without using Set iteration
  const uniqueFields = history
    .map((entry) => entry.field_name)
    .filter((field, index, self) => 
      field && self.indexOf(field) === index
    ) as string[];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="View task history"
                onClick={() => {
                  console.log("History button clicked for task:", taskId);
                  setOpen(true);
                }}
              >
                <History className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>View task history</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex justify-between items-center">
            <span>Task History - {taskTitle}</span>
            <div className="flex items-center space-x-2">
              <Select
                value={filter || "all"}
                onValueChange={(value) =>
                  setFilter(value === "all" ? null : value)
                }
              >
                <SelectTrigger className="w-[130px] h-8">
                  <SelectValue placeholder="All fields" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All fields</SelectItem>
                  {uniqueFields.map((field) => (
                    <SelectItem key={field} value={field}>
                      {getFieldLabel(field)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setSortDirection(sortDirection === "asc" ? "desc" : "asc")
                }
                className="flex items-center gap-1 h-8"
              >
                {sortDirection === "asc" ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                {sortDirection === "asc" ? "Oldest" : "Newest"}
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">
              No history records found.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredHistory.map((entry) => {
                // Special handling for assignment changes
                if (entry.change_type === 'assignment' || entry.field_name === 'assigned_to') {
                  console.log("Assignment entry:", entry);
                  
                  // Improve assignee name extraction
                  let assigneeName = "a user";
                  
                  if (entry.assignee_data && entry.assignee_data.name) {
                    assigneeName = entry.assignee_data.name;
                  } else if (entry.assignee_data && entry.assignee_data.email) {
                    assigneeName = entry.assignee_data.email;
                  } else if (entry.assigned_to || entry.new_value) {
                    const userId = entry.assigned_to || entry.new_value;
                    if (typeof userId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
                      assigneeName = "User ID: " + userId.substring(0, 8) + "...";
                    } else if (entry.new_value) {
                      const formattedValue = formatValue(entry.new_value);
                      assigneeName = typeof formattedValue === 'string' ? formattedValue : "a user";
                    }
                  }
                  
                  return (
                    <div key={entry.id} className="border rounded-lg p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className={getActionColor(entry.action_type)}>
                            {entry.action_type}
                          </Badge>
                          <span className="font-medium">Assignment Change</span>
                        </div>
                        <time className="text-xs text-muted-foreground">
                          {format(new Date(entry.created_at), "MMM d, yyyy h:mm a")}
                        </time>
                      </div>
                      <p className="text-sm mt-2">
                        <span className="font-medium">{getUserName(entry)}</span>{" "}
                        {(entry.assigned_to || entry.new_value) 
                          ? `assigned the task to ${assigneeName}`
                          : "unassigned the task"}
                      </p>
                    </div>
                  );
                }
                
                // Default rendering for other entry types
                return (
                  <div key={entry.id} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={getActionColor(entry.action_type)}>
                          {entry.action_type}
                        </Badge>
                        <span className="font-medium">
                          {getFieldLabel(entry.field_name)}
                        </span>
                      </div>
                      <time className="text-xs text-muted-foreground">
                        {format(new Date(entry.created_at), "MMM d, yyyy h:mm a")}
                      </time>
                    </div>
                    <p className="text-sm mt-2">
                      <span className="font-medium">{getUserName(entry)}</span>{" "}
                      {entry.action_type === "create"
                        ? "created the task"
                        : entry.action_type === "delete"
                        ? "deleted the task"
                        : "changed the value from"}{" "}
                      {entry.action_type === "update" && (
                        <>
                          <span className="px-1 py-0.5 bg-red-100 dark:bg-red-900 rounded">
                            {formatValue(entry.old_value)}
                          </span>{" "}
                          to{" "}
                          <span className="px-1 py-0.5 bg-green-100 dark:bg-green-900 rounded">
                            {formatValue(entry.new_value)}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
