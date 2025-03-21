"use client";

import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Calendar } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar as CalendarComponent } from "./ui/calendar";
import { format } from "date-fns";

type DueDateFilterProps = {
  value?: string | null;
  onChange: (filter: string | null) => void;
};

export default function DueDateFilter({ value, onChange }: DueDateFilterProps) {
  const [selectedFilter, setSelectedFilter] = useState<string | null>(value || null);
  const [date, setDate] = useState<Date | undefined>(undefined);

  // Update selected filter when value prop changes
  useEffect(() => {
    setSelectedFilter(value || null);
    
    // If it's a custom date, parse it
    if (value?.startsWith("custom:")) {
      const dateStr = value.substring(7);
      setDate(new Date(dateStr));
    } else {
      setDate(undefined);
    }
  }, [value]);

  const handleFilterClick = (filter: string) => {
    if (selectedFilter === filter) {
      setSelectedFilter(null);
      onChange(null);
    } else {
      setSelectedFilter(filter);
      onChange(filter);
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    setDate(date);
    if (date) {
      setSelectedFilter("custom");
      onChange(`custom:${date.toISOString()}`);
    } else {
      setSelectedFilter(null);
      onChange(null);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <div className="text-sm font-medium">Due:</div>
      <Button
        variant={selectedFilter === "today" ? "default" : "outline"}
        size="sm"
        onClick={() => handleFilterClick("today")}
      >
        Today
      </Button>
      <Button
        variant={selectedFilter === "tomorrow" ? "default" : "outline"}
        size="sm"
        onClick={() => handleFilterClick("tomorrow")}
      >
        Tomorrow
      </Button>
      <Button
        variant={selectedFilter === "week" ? "default" : "outline"}
        size="sm"
        onClick={() => handleFilterClick("week")}
      >
        Week
      </Button>
      <Button
        variant={selectedFilter === "overdue" ? "default" : "outline"}
        size="sm"
        onClick={() => handleFilterClick("overdue")}
      >
        Overdue
      </Button>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={selectedFilter === "custom" ? "default" : "outline"}
            size="sm"
            className="flex items-center gap-1"
          >
            <Calendar className="h-4 w-4" />
            {date ? format(date, "PP") : "Custom"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <CalendarComponent
            mode="single"
            selected={date}
            onSelect={handleDateSelect}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
