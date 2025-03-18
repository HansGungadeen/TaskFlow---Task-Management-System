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
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
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
      // Fetch task history without trying to join user information
      const { data, error } = await supabaseRef.current
        .from("task_history")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: sortDirection === "asc" });

      // If we need user information, we can fetch it separately
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((entry) => entry.user_id))];
        const { data: userData, error: userError } = await supabaseRef.current
          .from("users")
          .select("id, name, full_name, email")
          .in("id", userIds);

        if (!userError && userData) {
          // Add user information to each history entry
          data.forEach((entry) => {
            entry.user =
              userData.find((user) => user.id === entry.user_id) || null;
          });
        }
      }

      if (error) throw error;
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

  const formatValue = (value: string | null) => {
    if (value === null) return "None";
    if (value === "") return "Empty";

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

  const getFieldLabel = (field: string) => {
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

  const uniqueFields = [
    ...new Set(history.map((entry) => entry.field_name)),
  ].filter(Boolean);

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
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex flex-col space-y-2">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-[100px]" />
                    <Skeleton className="h-4 w-[120px]" />
                  </div>
                  <Skeleton className="h-16 w-full" />
                </div>
              ))}
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No history records found for this task.
            </div>
          ) : (
            <div className="space-y-6">
              {filteredHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="border rounded-lg p-4 space-y-2 bg-card"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <Badge
                        className={getActionColor(entry.action_type)}
                        variant="outline"
                      >
                        {entry.action_type.charAt(0).toUpperCase() +
                          entry.action_type.slice(1)}
                      </Badge>
                      <span className="font-medium">
                        {getFieldLabel(entry.field_name)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <div>{format(parseISO(entry.created_at), "PPp")}</div>
                      <div className="text-right">{getUserName(entry)}</div>
                    </div>
                  </div>

                  {entry.action_type === "create" ||
                  entry.action_type === "delete" ? (
                    <div className="bg-muted p-3 rounded-md text-sm">
                      {entry.action_type === "create" ? (
                        <div>
                          <div className="font-medium mb-1">
                            Created with values:
                          </div>
                          {formatValue(entry.new_value)}
                        </div>
                      ) : (
                        <div>
                          <div className="font-medium mb-1">
                            Deleted values:
                          </div>
                          {formatValue(entry.old_value)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-muted p-3 rounded-md text-sm">
                        <div className="font-medium mb-1">Previous value:</div>
                        <div>{formatValue(entry.old_value)}</div>
                      </div>
                      <div className="bg-muted p-3 rounded-md text-sm">
                        <div className="font-medium mb-1">New value:</div>
                        <div>{formatValue(entry.new_value)}</div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
