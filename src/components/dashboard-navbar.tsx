"use client";

import Link from "next/link";
import { createClient } from "../../supabase/client";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import { UserCircle, Home, CheckSquare, Plus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";
import UserProfile from "./user-profile";
import { NotificationBell } from "./notification-bell";

export default function DashboardNavbar() {
  const supabase = createClient();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUserId(data.user.id);
      }
    };
    
    fetchUser();
  }, [supabase.auth]);

  return (
    <nav className="w-full border-b border-border bg-background py-4">
      <div className="container mx-auto px-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            prefetch
            className="text-xl font-bold flex items-center"
          >
            <CheckSquare className="h-6 w-6 text-brand-600 mr-2" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-brand-400 font-bold">
              TaskFlow
            </span>
          </Link>
          <div className="hidden md:flex space-x-6 ml-8">
            <Link
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground flex items-center"
            >
              <Home className="h-4 w-4 mr-1" /> Dashboard
            </Link>
            <Link
              href="/teams"
              className="text-muted-foreground hover:text-foreground flex items-center"
            >
              <Users className="h-4 w-4 mr-1" /> Teams
            </Link>
          </div>
        </div>
        <div className="flex gap-4 items-center">
          <Button variant="outline" className="flex items-center gap-1">
            <Plus className="h-4 w-4" /> New Task
          </Button>
          {userId && <NotificationBell userId={userId} />}
          <ThemeToggle />
          <UserProfile />
        </div>
      </div>
    </nav>
  );
}
