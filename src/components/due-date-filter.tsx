"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Calendar } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar as CalendarComponent } from "./ui/calendar";
import { format } from "date-fns";

type DueDateFilterProps = {
  onFilterChange: (filter: string | null) => void;
};

export default function DueDateFilter({ onFilterChange }: DueDateFilterProps) {
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [date, setDate] = useState<Date | undefined>(undefined);

  const handleFilterClick = (filter: string) => {
    if (selectedFilter === filter) {
      setSelectedFilter(null);
      onFilterChange(null);
    } else {
      setSelectedFilter(filter);
      onFilterChange(filter);
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    setDate(date);
    if (date) {
      setSelectedFilter("custom");
      onFilterChange(`custom:${date.toISOString()}`);
    } else {
      setSelectedFilter(null);
      onFilterChange(null);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <div className="text-sm font-medium">Due Date:</div>
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
        This Week
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
      {selectedFilter && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSelectedFilter(null);
            setDate(undefined);
            onFilterChange(null);
          }}
        >
          Clear
        </Button>
      )}
    </div>
  );
}
