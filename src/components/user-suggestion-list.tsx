"use client";

import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Card } from "./ui/card";

// Define user type to match what we need for suggestions
export interface User {
  id: string;
  name?: string;
  email: string;
  avatar_url?: string;
}

interface UserSuggestionListProps {
  users: User[];
  query: string;
  onSelectUser: (user: User) => void;
}

export function UserSuggestionList({ 
  users, 
  query, 
  onSelectUser 
}: UserSuggestionListProps) {
  // Filter users based on query
  const filteredUsers = users.filter(user => {
    const nameMatch = user.name?.toLowerCase().includes(query.toLowerCase());
    const emailMatch = user.email.toLowerCase().includes(query.toLowerCase());
    return nameMatch || emailMatch;
  });
  
  // Return early if no results
  if (filteredUsers.length === 0) {
    return (
      <Card className="p-2 shadow-md">
        <div className="text-sm p-2 text-muted-foreground">
          No users found
        </div>
      </Card>
    );
  }
  
  // Get user initials for avatar
  const getUserInitials = (name?: string, email?: string): string => {
    if (name && name.length > 0) {
      const nameParts = name.split(' ');
      if (nameParts.length >= 2) {
        return (nameParts[0][0] + nameParts[1][0]).toUpperCase();
      }
      return name[0].toUpperCase();
    }
    if (email && email.length > 0) {
      return email[0].toUpperCase();
    }
    return '?';
  };
  
  return (
    <Card className="p-1 shadow-md">
      <ul className="max-h-48 overflow-y-auto">
        {filteredUsers.map(user => (
          <li 
            key={user.id}
            className="px-2 py-1.5 flex items-center gap-2 hover:bg-secondary rounded cursor-pointer"
            onClick={() => onSelectUser(user)}
          >
            <Avatar className="w-6 h-6">
              <AvatarImage src={user.avatar_url || ''} alt={user.name || user.email} />
              <AvatarFallback>{getUserInitials(user.name, user.email)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              {user.name && <span className="text-sm font-medium">{user.name}</span>}
              <span className="text-xs text-muted-foreground">{user.email}</span>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
} 