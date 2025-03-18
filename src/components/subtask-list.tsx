"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import { Trash2, Plus } from "lucide-react";
import { Label } from "./ui/label";

type Subtask = {
  id: string;
  task_id: string;
  title: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
  user_id: string;
};

type SubtaskListProps = {
  taskId: string;
  userId: string;
  onSubtasksChange?: () => void;
};

export default function SubtaskList({
  taskId,
  userId,
  onSubtasksChange,
}: SubtaskListProps) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  // Fetch subtasks for the task
  useEffect(() => {
    const fetchSubtasks = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from("subtasks")
          .select("*")
          .eq("task_id", taskId)
          .order("created_at", { ascending: true });

        if (error) throw error;
        setSubtasks(data || []);
      } catch (error) {
        console.error("Error fetching subtasks:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (taskId) {
      fetchSubtasks();
    }
  }, [taskId, supabase]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!taskId) return;

    const channel = supabase
      .channel(`subtasks-${taskId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subtasks",
          filter: `task_id=eq.${taskId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setSubtasks((prev) => [...prev, payload.new as Subtask]);
          } else if (payload.eventType === "UPDATE") {
            setSubtasks((prev) =>
              prev.map((subtask) =>
                subtask.id === payload.new.id
                  ? (payload.new as Subtask)
                  : subtask,
              ),
            );
          } else if (payload.eventType === "DELETE") {
            setSubtasks((prev) =>
              prev.filter((subtask) => subtask.id !== payload.old.id),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId, supabase]);

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim() || !taskId || !userId) return;

    try {
      const { data, error } = await supabase
        .from("subtasks")
        .insert([
          {
            task_id: taskId,
            title: newSubtaskTitle.trim(),
            completed: false,
            user_id: userId,
          },
        ])
        .select();

      if (error) throw error;

      if (data) {
        setNewSubtaskTitle("");
        if (onSubtasksChange) onSubtasksChange();
      }
    } catch (error) {
      console.error("Error adding subtask:", error);
    }
  };

  const handleToggleSubtask = async (subtaskId: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from("subtasks")
        .update({ completed })
        .eq("id", subtaskId);

      if (error) throw error;
      if (onSubtasksChange) onSubtasksChange();
    } catch (error) {
      console.error("Error updating subtask:", error);
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    try {
      const { error } = await supabase
        .from("subtasks")
        .delete()
        .eq("id", subtaskId);

      if (error) throw error;
      if (onSubtasksChange) onSubtasksChange();
    } catch (error) {
      console.error("Error deleting subtask:", error);
    }
  };

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading subtasks...</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-2">
        <Input
          placeholder="Add a subtask"
          value={newSubtaskTitle}
          onChange={(e) => setNewSubtaskTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleAddSubtask();
            }
          }}
          className="flex-1"
        />
        <Button
          size="sm"
          onClick={handleAddSubtask}
          disabled={!newSubtaskTitle.trim()}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {subtasks.length === 0 ? (
        <div className="text-sm text-gray-500 py-2">No subtasks yet</div>
      ) : (
        <div className="space-y-2">
          {subtasks.map((subtask) => (
            <div
              key={subtask.id}
              className="flex items-center justify-between py-1 px-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`subtask-${subtask.id}`}
                  checked={subtask.completed}
                  onCheckedChange={(checked) =>
                    handleToggleSubtask(subtask.id, checked === true)
                  }
                />
                <Label
                  htmlFor={`subtask-${subtask.id}`}
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
  );
}
