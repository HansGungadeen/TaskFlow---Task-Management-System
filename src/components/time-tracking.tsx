"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/utils";
import { TimeEntry } from "@/types/tasks";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Clock, Plus, Trash2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { format } from "date-fns";
import { toast } from "./ui/use-toast";

type TimeTrackingProps = {
  taskId: string;
  userId: string;
  initialTimeEntries?: TimeEntry[];
  initialTotalHours?: number;
  onTimeUpdate?: (totalHours: number) => void;
  readOnly?: boolean;
};

export default function TimeTracking({
  taskId,
  userId,
  initialTimeEntries = [],
  initialTotalHours = 0,
  onTimeUpdate,
  readOnly = false,
}: TimeTrackingProps) {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(initialTimeEntries);
  const [totalHours, setTotalHours] = useState<number>(initialTotalHours);
  const [isAddingTime, setIsAddingTime] = useState(false);
  const [newTimeEntry, setNewTimeEntry] = useState({
    hours: "",
    description: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Initialize Supabase client
  const supabase = createClient();

  // Subscribe to time entries changes
  useEffect(() => {
    const channel = supabase
      .channel(`time-entries-${taskId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "time_entries",
          filter: `task_id=eq.${taskId}`,
        },
        (payload) => {
          console.log("Time entry change detected:", payload);
          fetchTimeEntries();
        }
      )
      .subscribe();

    // Fetch time entries on mount
    fetchTimeEntries();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId]);

  // Fetch time entries
  const fetchTimeEntries = async () => {
    try {
      const { data, error } = await supabase
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

      if (error) {
        console.error("Error fetching time entries:", error);
        return;
      }

      // Process and format the data
      const processedEntries = data.map((entry) => ({
        id: entry.id,
        task_id: entry.task_id,
        user_id: entry.user_id,
        hours: entry.hours,
        description: entry.description,
        created_at: entry.created_at,
        user_name: entry.users?.name || "",
        user_email: entry.users?.email || "",
        user_avatar_url: entry.users?.avatar_url || "",
      }));

      setTimeEntries(processedEntries);
      
      // Calculate total hours
      const total = processedEntries.reduce((sum, entry) => sum + entry.hours, 0);
      setTotalHours(total);
      
      // Call the callback if provided
      if (onTimeUpdate) {
        onTimeUpdate(total);
      }
    } catch (err) {
      console.error("Error in fetchTimeEntries:", err);
    }
  };

  // Add new time entry
  const addTimeEntry = async () => {
    setError("");
    
    // Validate input
    const hours = parseFloat(newTimeEntry.hours);
    if (isNaN(hours) || hours <= 0) {
      setError("Please enter a valid number of hours greater than 0");
      return;
    }
    
    // Max 100 hours per entry as a reasonable limit
    if (hours > 100) {
      setError("Time entries cannot exceed 100 hours");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.from("time_entries").insert({
        task_id: taskId,
        user_id: userId,
        hours,
        description: newTimeEntry.description || null,
      }).select();

      if (error) {
        console.error("Error adding time entry:", error);
        setError(error.message);
        return;
      }

      // Reset form
      setNewTimeEntry({ hours: "", description: "" });
      setIsAddingTime(false);
      toast({
        title: "Time entry added",
        description: `${hours} hour${hours === 1 ? "" : "s"} added to this task`,
      });
      
      // Refresh time entries
      fetchTimeEntries();
    } catch (err) {
      console.error("Error in addTimeEntry:", err);
      setError("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete time entry
  const deleteTimeEntry = async (entryId: string) => {
    try {
      const { error } = await supabase
        .from("time_entries")
        .delete()
        .eq("id", entryId)
        .eq("user_id", userId); // Ensure user can only delete their own entries

      if (error) {
        console.error("Error deleting time entry:", error);
        toast({
          title: "Error",
          description: "Failed to delete time entry. You can only delete your own entries.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Time entry deleted",
        description: "The time entry has been removed",
      });
      
      // Refresh time entries
      fetchTimeEntries();
    } catch (err) {
      console.error("Error in deleteTimeEntry:", err);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Badge variant="outline" className="text-md font-medium">
          Total: {totalHours.toFixed(1)} hour{totalHours === 1 ? "" : "s"}
        </Badge>
      </div>
      
      <div className="overflow-auto max-h-[400px]">
        {timeEntries.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Date</TableHead>
                {!readOnly && <TableHead className="w-16">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {timeEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={entry.user_avatar_url || undefined} />
                        <AvatarFallback>
                          {entry.user_name?.charAt(0) || entry.user_email?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{entry.user_name || entry.user_email}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{entry.hours.toFixed(1)}</TableCell>
                  <TableCell className="text-sm max-w-xs truncate">
                    {entry.description || "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(entry.created_at), "MMM d, yyyy")}
                  </TableCell>
                  {!readOnly && (
                    <TableCell>
                      {entry.user_id === userId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteTimeEntry(entry.id)}
                          className="h-7 w-7"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
            <Clock className="h-10 w-10 mb-2 text-muted-foreground/60" />
            <p>No time entries recorded yet</p>
            {!readOnly && (
              <p className="text-sm mt-1">
                Add your first time entry to track hours spent on this task
              </p>
            )}
          </div>
        )}
      </div>
      
      {!readOnly && (
        <div className="pt-4">
          {isAddingTime ? (
            <div className="w-full space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="hours">Hours *</Label>
                  <Input
                    id="hours"
                    type="number"
                    step="0.5"
                    min="0.5"
                    placeholder="Enter hours"
                    value={newTimeEntry.hours}
                    onChange={(e) =>
                      setNewTimeEntry({ ...newTimeEntry, hours: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Input
                    id="description"
                    placeholder="What did you work on?"
                    value={newTimeEntry.description}
                    onChange={(e) =>
                      setNewTimeEntry({ ...newTimeEntry, description: e.target.value })
                    }
                  />
                </div>
              </div>
              
              {error && (
                <div className="flex items-center text-destructive text-sm gap-1 mt-1">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}
              
              <div className="flex justify-end gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsAddingTime(false);
                    setNewTimeEntry({ hours: "", description: "" });
                    setError("");
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  size="sm" 
                  onClick={addTimeEntry} 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Saving..." : "Save Entry"}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => setIsAddingTime(true)}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Time Entry
            </Button>
          )}
        </div>
      )}
    </div>
  );
} 