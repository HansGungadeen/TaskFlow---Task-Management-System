"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Laptop } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "../../supabase/client";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const supabase = createClient();

  // Effect to load any theme colors from the database when the component mounts
  useEffect(() => {
    const loadUserTheme = async () => {
      try {
        // Get the current user
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setMounted(true);
          return;
        }
        
        // Get the user's theme preference
        const { data: userData } = await supabase
          .from('users')
          .select('theme_preference')
          .eq('id', user.id)
          .single();
          
        if (userData?.theme_preference) {
          // Check if the preference is a UUID (a color theme)
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userData.theme_preference);
          
          // If it's a UUID, load the theme from the database
          if (isUUID) {
            const { data: themeData } = await supabase
              .from('themes')
              .select('colors')
              .eq('id', userData.theme_preference)
              .single();
              
            if (themeData?.colors) {
              applyThemeColors(themeData.colors);
            }
          } 
          // If it's a display mode, set it
          else if (['light', 'dark', 'system'].includes(userData.theme_preference)) {
            setTheme(userData.theme_preference);
          }
        }
      } catch (error) {
        console.error("Error loading user theme:", error);
      } finally {
        setMounted(true);
      }
    };
    
    loadUserTheme();
  }, [supabase, setTheme]);

  // Effect to save the theme preference when it changes
  useEffect(() => {
    const saveThemePreference = async () => {
      if (!mounted) return;
      
      try {
        // Get the current user
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) return;
        
        // Get the user's current theme preference to check if it's a UUID
        const { data: userData } = await supabase
          .from('users')
          .select('theme_preference')
          .eq('id', user.id)
          .single();
          
        // Only update if the current preference is not a UUID
        // This prevents overwriting a color theme choice when the display mode changes
        if (userData?.theme_preference) {
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userData.theme_preference);
          
          // Only update if it's not a UUID or if there's no current preference
          if (!isUUID) {
            await supabase
              .from('users')
              .update({ theme_preference: theme })
              .eq('id', user.id);
          }
        } else {
          // No preference set yet, so save the current theme
          await supabase
            .from('users')
            .update({ theme_preference: theme })
            .eq('id', user.id);
        }
      } catch (error) {
        console.error("Error saving theme preference:", error);
      }
    };
    
    saveThemePreference();
  }, [theme, mounted, supabase]);

  // Apply theme colors to CSS variables
  const applyThemeColors = (colors: any) => {
    // Get CSS variables root
    const root = document.documentElement;
    
    // Apply primary color
    if (colors.primary) {
      const { hue, saturation, lightness } = colors.primary;
      root.style.setProperty('--primary', `${hue} ${saturation}% ${lightness}%`);
      root.style.setProperty('--ring', `${hue} ${saturation}% ${lightness}%`);
    }
    
    // Apply brand colors
    if (colors.brand) {
      const { hue, saturation, lightness } = colors.brand;
      
      // Generate brand color palette
      const generateBrandColor = (l: number) => {
        return `${hue} ${saturation}% ${l}%`;
      };
      
      root.style.setProperty('--brand-50', generateBrandColor(97));
      root.style.setProperty('--brand-100', generateBrandColor(94));
      root.style.setProperty('--brand-200', generateBrandColor(85));
      root.style.setProperty('--brand-300', generateBrandColor(75));
      root.style.setProperty('--brand-400', generateBrandColor(55));
      root.style.setProperty('--brand-500', generateBrandColor(45));
      root.style.setProperty('--brand-600', generateBrandColor(36));
      root.style.setProperty('--brand-700', generateBrandColor(29));
      root.style.setProperty('--brand-800', generateBrandColor(23));
      root.style.setProperty('--brand-900', generateBrandColor(19));
      root.style.setProperty('--brand-950', generateBrandColor(10));
    }
  };

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon">
        <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => {
        // Cycle through themes: system -> light -> dark -> system
        if (theme === "light") {
          setTheme("dark");
        } else if (theme === "dark") {
          setTheme("system");
        } else {
          setTheme("light");
        }
      }}
    >
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
