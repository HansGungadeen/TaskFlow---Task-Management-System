"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { createClient } from "../../supabase/client";
import { useEffect, useState } from "react";

interface Theme {
  id: string;
  name: string;
  description: string | null;
  colors: {
    primary: { hue: number; saturation: number; lightness: number };
    brand: { hue: number; saturation: number; lightness: number };
  };
}

interface CustomThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: string;
  storageKey?: string;
}

export function CustomThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'theme',
  ...props
}: CustomThemeProviderProps) {
  const [availableThemes, setAvailableThemes] = useState<Theme[]>([]);
  const [currentThemeId, setCurrentThemeId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const supabase = createClient();

  // Load available themes and user preference
  useEffect(() => {
    const loadThemes = async () => {
      try {
        // Get available theme presets
        const { data: themes, error } = await supabase
          .from('themes')
          .select('*')
          .order('name');

        if (error) {
          console.error("Error loading themes:", error);
          return;
        }

        setAvailableThemes(themes || []);

        // Get user's theme preference
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { data: userData } = await supabase
            .from('users')
            .select('theme_preference')
            .eq('id', user.id)
            .single();

          if (userData?.theme_preference) {
            setCurrentThemeId(userData.theme_preference);
            
            // Find theme in available themes and apply it
            const selectedTheme = themes?.find(t => t.id === userData.theme_preference);
            if (selectedTheme) {
              applyThemeColors(selectedTheme.colors);
            }
          }
        }
      } catch (error) {
        console.error("Error in theme setup:", error);
      } finally {
        setIsLoaded(true);
      }
    };

    loadThemes();
  }, [supabase]);

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
      
      // Generate a palette of brand colors
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

  // Use standard theme provider while loading custom themes
  return (
    <NextThemesProvider 
      defaultTheme={defaultTheme}
      storageKey={storageKey}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
} 