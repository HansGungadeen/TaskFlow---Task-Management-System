"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { createClient } from "../../supabase/client";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const supabase = createClient();

  // Load user preference from database on mount
  useEffect(() => {
    const loadUserPreference = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data } = await supabase
            .from("users")
            .select("theme_preference")
            .eq("id", user.id)
            .single();

          if (data?.theme_preference && data.theme_preference !== "system") {
            setTheme(data.theme_preference);
          }
        }
      } catch (error) {
        console.error("Error loading theme preference:", error);
      } finally {
        setMounted(true);
      }
    };

    loadUserPreference();
  }, [supabase, setTheme]);

  // Save user preference to database when theme changes
  useEffect(() => {
    const saveUserPreference = async () => {
      if (!mounted) return;

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user && theme) {
          await supabase
            .from("users")
            .update({ theme_preference: theme })
            .eq("id", user.id);
        }
      } catch (error) {
        console.error("Error saving theme preference:", error);
      }
    };

    saveUserPreference();
  }, [theme, mounted, supabase]);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="rounded-full">
        <Sun className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="rounded-full"
    >
      {theme === "dark" ? (
        <Moon className="h-5 w-5 text-brand-300" />
      ) : (
        <Sun className="h-5 w-5 text-brand-600" />
      )}
      <span className="sr-only">
        {theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      </span>
    </Button>
  );
}
