"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Users } from "lucide-react";

type Team = {
  id: string;
  name: string;
};

interface TeamSelectorProps {
  teams: Team[];
  value: string | null;
  onChange: (teamId: string | null) => void;
}

export default function TeamSelector({
  teams,
  value,
  onChange,
}: TeamSelectorProps) {
  const handleValueChange = (value: string) => {
    // Handle "none" special case to clear team selection
    if (value === "none") {
      onChange(null);
    } else {
      onChange(value);
    }
  };

  return (
    <Select
      value={value || "none"}
      onValueChange={handleValueChange}
    >
      <SelectTrigger className="mt-1">
        <SelectValue placeholder="No team" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-muted-foreground" />
            <span>No team</span>
          </div>
        </SelectItem>
        
        {teams.map((team) => (
          <SelectItem key={team.id} value={team.id}>
            <div className="flex items-center gap-2">
              <Users size={16} />
              <span>{team.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
} 