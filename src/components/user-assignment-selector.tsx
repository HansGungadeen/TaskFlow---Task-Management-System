"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "./ui/avatar";
import { AssigneeData } from "@/types/tasks";
import { UserCircle } from "lucide-react";

interface UserAssignmentSelectorProps {
  teamId: string | null;
  value: string | null;
  onChange: (userId: string | null) => void;
  defaultUserId?: string | null;
}

export default function UserAssignmentSelector({
  teamId,
  value,
  onChange,
  defaultUserId,
}: UserAssignmentSelectorProps) {
  const [teamMembers, setTeamMembers] = useState<AssigneeData[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  // Fetch team members when teamId changes
  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (!teamId) {
        setTeamMembers([]);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("team_members_with_users")
          .select("*")
          .eq("team_id", teamId);

        if (error) throw error;

        if (data) {
          const members: AssigneeData[] = data.map(member => ({
            id: member.user_id,
            email: member.user_email || '',
            name: member.user_name || undefined,
            avatar_url: member.user_avatar_url || undefined
          }));
          setTeamMembers(members);
        }
      } catch (error) {
        console.error("Error fetching team members:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTeamMembers();
  }, [teamId, supabase]);

  const handleValueChange = (value: string) => {
    // Handle "none" special case to clear assignment
    if (value === "none") {
      onChange(null);
    } else {
      onChange(value);
    }
  };

  // Helper function to get user initials for avatar fallback
  const getInitials = (name?: string, email?: string): string => {
    if (name) {
      return name
        .split(' ')
        .map(part => part[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
    }
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    return 'US';
  };

  return (
    <Select
      value={value || "none"}
      onValueChange={handleValueChange}
      disabled={!teamId || loading}
    >
      <SelectTrigger>
        <SelectValue placeholder="Unassigned" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">
          <div className="flex items-center gap-2">
            <UserCircle size={18} className="text-muted-foreground" />
            <span>Unassigned</span>
          </div>
        </SelectItem>
        
        {teamMembers.map((member) => (
          <SelectItem key={member.id} value={member.id}>
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={member.avatar_url || ""} />
                <AvatarFallback>{getInitials(member.name, member.email)}</AvatarFallback>
              </Avatar>
              <span>{member.name || member.email}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
} 