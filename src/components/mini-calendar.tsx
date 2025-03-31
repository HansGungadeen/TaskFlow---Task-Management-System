"use client";

import { useState, useEffect, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Task } from "@/types/tasks";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

interface MiniCalendarProps {
  tasks: Task[];
  teamId?: string | null;
}

export default function MiniCalendar({ tasks, teamId }: MiniCalendarProps) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [isClient, setIsClient] = useState(false);

  // Set isClient to true once component mounts
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Handle month navigation
  const handlePreviousMonth = () => {
    setCurrentDate(prevDate => subMonths(prevDate, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prevDate => addMonths(prevDate, 1));
  };

  // Compute calendar days for the current month
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    
    return eachDayOfInterval({
      start: startDate,
      end: endDate
    });
  }, [currentDate]);

  // Filter tasks for each day
  const getTasksForDay = (date: Date) => {
    return tasks.filter(task => {
      if (!task.due_date) return false;
      
      // If team ID is provided, filter by team
      if (teamId && task.team_id !== teamId) return false;
      
      const taskDate = new Date(task.due_date);
      return isSameDay(date, taskDate);
    });
  };

  // Return placeholder during server-side rendering
  if (!isClient) {
    return <div className="h-full flex items-center justify-center">Loading calendar...</div>;
  }

  return (
    <div className="w-full px-1 pb-2">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-medium text-sm">
          {format(currentDate, "MMMM yyyy")}
        </h2>
        <div className="flex space-x-1">
          <Button
            variant="ghost" 
            size="icon"
            className="h-7 w-7"
            onClick={handlePreviousMonth}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost" 
            size="icon"
            className="h-7 w-7"
            onClick={handleNextMonth}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-0 text-center border rounded-md overflow-hidden shadow-sm">
        {/* Day headers */}
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day, index) => (
          <div key={day} className="text-xs font-bold uppercase text-primary/90 bg-secondary/50 py-1.5 border-b border-r last:border-r-0">
            {day}
          </div>
        ))}
        
        {/* Calendar days */}
        {calendarDays.map((day, index) => {
          const dayTasks = getTasksForDay(day);
          const today = isSameDay(day, new Date());
          const sameMonth = isSameMonth(day, currentDate);
          const hasTask = dayTasks.length > 0;
          
          // Create query params for the link
          const params = new URLSearchParams();
          if (teamId) params.set('team', teamId);
          params.set('date', format(day, 'yyyy-MM-dd'));
          
          // Calculate border classes
          const isLastInRow = (index + 1) % 7 === 0;
          const isLastRow = index >= calendarDays.length - 7;
          const borderClasses = `border-r ${isLastInRow ? 'border-r-0' : ''} border-b ${isLastRow ? 'border-b-0' : ''}`;
          
          // Day cell content
          const dayContent = (
            <div 
              className={cn(
                "aspect-square min-h-[32px] flex flex-col items-center justify-start p-1 relative text-xs font-normal hover:bg-accent/40 transition-colors cursor-pointer",
                today && "bg-accent/60 hover:bg-accent/80",
                !sameMonth && "text-muted-foreground bg-muted/30",
                hasTask && "font-medium",
                borderClasses
              )}
            >
              <span className="z-10">{format(day, "d")}</span>
              
              {/* Task indicators */}
              {hasTask && (
                <div className="absolute bottom-1 flex justify-center gap-1 w-full">
                  {dayTasks.length <= 3 ? (
                    dayTasks.slice(0, 3).map((_, i) => (
                      <div key={i} className="h-1 w-1 rounded-full bg-primary"></div>
                    ))
                  ) : (
                    <>
                      <div className="h-1 w-1 rounded-full bg-primary"></div>
                      <div className="h-1 w-1 rounded-full bg-primary"></div>
                      <div className="text-[8px] leading-none">+{dayTasks.length - 2}</div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
          
          // Render with tooltip if has tasks
          return (
            <div key={index}>
              {hasTask ? (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link href={`/dashboard/calendar?${params.toString()}`}>
                        {dayContent}
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" className="max-w-[200px]">
                      <div className="space-y-1">
                        <p className="font-medium text-xs">{format(day, "EEEE, MMMM d, yyyy")}</p>
                        <ul className="text-xs space-y-1">
                          {dayTasks.slice(0, 5).map((task, i) => (
                            <li key={i} className="truncate">
                              {task.status === "done" ? "✓ " : "• "} 
                              {task.title}
                            </li>
                          ))}
                          {dayTasks.length > 5 && (
                            <li className="text-muted-foreground">
                              +{dayTasks.length - 5} more tasks
                            </li>
                          )}
                        </ul>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <Link href={`/dashboard/calendar?${params.toString()}`}>
                  {dayContent}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
} 