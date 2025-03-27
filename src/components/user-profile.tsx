"use client";
import { UserCircle, Sun, Moon, Laptop, Settings } from "lucide-react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { createClient } from "../../supabase/client";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function UserProfile() {
  const supabase = createClient();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const saveThemePreference = async (newTheme: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("users")
          .update({ theme_preference: newTheme })
          .eq("id", user.id);
      }
    } catch (error) {
      console.error("Error saving theme preference:", error);
    }
  };

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    saveThemePreference(newTheme);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <UserCircle className="h-6 w-6" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <Link href="/dashboard/profile">
          <DropdownMenuItem className="cursor-pointer flex items-center gap-2">
            <Settings size={16} />
            Edit Profile
          </DropdownMenuItem>
        </Link>
        <DropdownMenuSeparator />
        {mounted && (
          <>
            <DropdownMenuItem
              onClick={() => handleThemeChange("light")}
              className="flex items-center gap-2"
            >
              <Sun size={16} className="text-brand-600" />
              Light Mode
              {theme === "light" && " ✓"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleThemeChange("dark")}
              className="flex items-center gap-2"
            >
              <Moon size={16} className="text-brand-300" />
              Dark Mode
              {theme === "dark" && " ✓"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleThemeChange("system")}
              className="flex items-center gap-2"
            >
              <Laptop size={16} />
              System Theme
              {theme === "system" && " ✓"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem
          onClick={async () => {
            await supabase.auth.signOut();
            router.refresh();
          }}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
