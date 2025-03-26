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
import { UserCircle, Home, CheckSquare, Plus, Users, LayoutGrid, Calendar, Menu, X } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";
import UserProfile from "./user-profile";
import { NotificationBell } from "./notification-bell";
import { cn } from "@/lib/utils";

export default function DashboardNavbar() {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
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
      <div className="container mx-auto px-4 max-w-full md:max-w-[95%] lg:max-w-[90%] xl:max-w-[1280px] flex justify-between items-center">
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
              className={cn(
                "hover:text-foreground flex items-center",
                pathname === "/dashboard" 
                  ? "text-foreground font-medium" 
                  : "text-muted-foreground"
              )}
            >
              <Home className="h-4 w-4 mr-1" /> Dashboard
            </Link>
            <Link
              href="/dashboard/kanban"
              className={cn(
                "hover:text-foreground flex items-center",
                pathname === "/dashboard/kanban" 
                  ? "text-foreground font-medium" 
                  : "text-muted-foreground"
              )}
            >
              <LayoutGrid className="h-4 w-4 mr-1" /> Kanban
            </Link>
            <Link
              href="/dashboard/calendar"
              className={cn(
                "hover:text-foreground flex items-center",
                pathname === "/dashboard/calendar" 
                  ? "text-foreground font-medium" 
                  : "text-muted-foreground"
              )}
            >
              <Calendar className="h-4 w-4 mr-1" /> Calendar
            </Link>
            <Link
              href="/teams"
              className={cn(
                "hover:text-foreground flex items-center",
                pathname.startsWith("/teams") 
                  ? "text-foreground font-medium" 
                  : "text-muted-foreground"
              )}
            >
              <Users className="h-4 w-4 mr-1" /> Teams
            </Link>
          </div>
        </div>
        <div className="flex gap-3 items-center">
          {/* Mobile menu button */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden" 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          
          <Button 
            variant="outline" 
            className="hidden md:flex items-center gap-1" 
            onClick={() => router.push('/dashboard')}
          >
            <Plus className="h-4 w-4" /> New Task
          </Button>
          {userId && <NotificationBell userId={userId} />}
          <ThemeToggle />
          <UserProfile />
        </div>
      </div>
      
      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden px-4 py-3 bg-background border-b border-border">
          <div className="flex flex-col space-y-4">
            <Link
              href="/dashboard"
              className={cn(
                "hover:text-foreground flex items-center py-2",
                pathname === "/dashboard" 
                  ? "text-foreground font-medium" 
                  : "text-muted-foreground"
              )}
              onClick={() => setMobileMenuOpen(false)}
            >
              <Home className="h-4 w-4 mr-2" /> Dashboard
            </Link>
            <Link
              href="/dashboard/kanban"
              className={cn(
                "hover:text-foreground flex items-center py-2",
                pathname === "/dashboard/kanban" 
                  ? "text-foreground font-medium" 
                  : "text-muted-foreground"
              )}
              onClick={() => setMobileMenuOpen(false)}
            >
              <LayoutGrid className="h-4 w-4 mr-2" /> Kanban
            </Link>
            <Link
              href="/dashboard/calendar"
              className={cn(
                "hover:text-foreground flex items-center py-2",
                pathname === "/dashboard/calendar" 
                  ? "text-foreground font-medium" 
                  : "text-muted-foreground"
              )}
              onClick={() => setMobileMenuOpen(false)}
            >
              <Calendar className="h-4 w-4 mr-2" /> Calendar
            </Link>
            <Link
              href="/teams"
              className={cn(
                "hover:text-foreground flex items-center py-2",
                pathname.startsWith("/teams") 
                  ? "text-foreground font-medium" 
                  : "text-muted-foreground"
              )}
              onClick={() => setMobileMenuOpen(false)}
            >
              <Users className="h-4 w-4 mr-2" /> Teams
            </Link>
            <Button 
              variant="outline" 
              size="sm"
              className="flex items-center gap-1 w-full justify-center" 
              onClick={() => {
                router.push('/dashboard');
                setMobileMenuOpen(false);
              }}
            >
              <Plus className="h-4 w-4" /> New Task
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
}
