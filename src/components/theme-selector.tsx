"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { createClient } from "../../supabase/client";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { PaletteIcon, Check, Sun, Moon, Laptop } from "lucide-react";

interface Theme {
  id: string;
  name: string;
  description: string | null;
  is_preset: boolean;
  colors: {
    primary: { hue: number; saturation: number; lightness: number };
    brand: { hue: number; saturation: number; lightness: number };
  };
  created_by: string | null;
}

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [presetThemes, setPresetThemes] = useState<Theme[]>([]);
  const [currentThemeId, setCurrentThemeId] = useState<string | null>(null);
  
  const supabase = createClient();

  // Load preset themes from database
  useEffect(() => {
    const loadThemes = async () => {
      try {
        // Get user data
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setMounted(true);
          return;
        }
        
        // Get available preset themes
        const { data: themes, error } = await supabase
          .from('themes')
          .select('*')
          .eq('is_preset', true)
          .order('name');
          
        if (error) {
          console.error("Error loading themes:", error);
          return;
        }
        
        setPresetThemes(themes || []);
        
        // Get user's current theme preference
        const { data: userData } = await supabase
          .from('users')
          .select('theme_preference')
          .eq('id', user.id)
          .single();
        
        if (userData?.theme_preference) {
          // Check if it's a UUID (theme preset)
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userData.theme_preference);
          if (isUUID) {
            setCurrentThemeId(userData.theme_preference);
            
            // Load and apply the theme
            const selectedTheme = themes?.find(t => t.id === userData.theme_preference);
            if (selectedTheme) {
              applyThemeColors(selectedTheme.colors);
            }
          }
        }
      } catch (error) {
        console.error("Error in theme setup:", error);
      } finally {
        setMounted(true);
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

  // Select a theme
  const selectTheme = async (themeId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;
      
      // Update user's theme preference
      await supabase
        .from('users')
        .update({ theme_preference: themeId })
        .eq('id', user.id);
        
      setCurrentThemeId(themeId);
      
      // Apply theme colors
      const selectedTheme = presetThemes.find(t => t.id === themeId);
      if (selectedTheme) {
        applyThemeColors(selectedTheme.colors);
      }
    } catch (error) {
      console.error("Error selecting theme:", error);
    }
  };

  // Clear the selected theme
  const clearTheme = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;
      
      // Update user's theme preference to current display mode
      await supabase
        .from('users')
        .update({ theme_preference: theme })
        .eq('id', user.id);
        
      setCurrentThemeId(null);
      
      // Reset to default theme colors
      const root = document.documentElement;
      const defaultColors = {
        primary: { hue: 142.1, saturation: 76.2, lightness: 36.3 },
        brand: { hue: 142, saturation: 76, lightness: 45 }
      };
      
      applyThemeColors(defaultColors);
    } catch (error) {
      console.error("Error clearing theme:", error);
    }
  };

  if (!mounted) {
    return <Button variant="ghost" size="icon"><PaletteIcon className="h-5 w-5" /></Button>;
  }

  return (
    <div className="relative">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <PaletteIcon className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[200px]">
          <div className="p-2">
            <h4 className="text-sm font-medium mb-2">Color Themes</h4>
            <div className="space-y-1">
              <button
                onClick={clearTheme}
                className={`flex items-center justify-between w-full px-2 py-1.5 text-sm rounded-md ${
                  !currentThemeId ? 'bg-muted' : 'hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center">
                  <div className="w-4 h-4 rounded-full bg-primary mr-2" />
                  <span>Default</span>
                </div>
                {!currentThemeId && (
                  <Check className="h-4 w-4" />
                )}
              </button>
              {presetThemes.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => selectTheme(theme.id)}
                  className={`flex items-center justify-between w-full px-2 py-1.5 text-sm rounded-md ${
                    currentThemeId === theme.id ? 'bg-muted' : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center">
                    <div 
                      className="w-4 h-4 rounded-full mr-2" 
                      style={{
                        backgroundColor: `hsl(${theme.colors.primary.hue} ${theme.colors.primary.saturation}% ${theme.colors.primary.lightness}%)`
                      }}
                    />
                    <span>{theme.name}</span>
                  </div>
                  {currentThemeId === theme.id && (
                    <Check className="h-4 w-4" />
                  )}
                </button>
              ))}
            </div>
          </div>
          <DropdownMenuSeparator />
          <div className="px-2 py-2">
            <div className="text-xs text-muted-foreground mb-2">
              Display Mode: {theme === 'dark' ? 'Dark' : theme === 'light' ? 'Light' : 'System'}
            </div>
            <div className="grid grid-cols-3 gap-1">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setTheme('light')}
                className={`${theme === 'light' ? 'bg-muted border-primary' : 'border-muted'} flex items-center justify-center border shadow-sm`}
              >
                <Sun className="h-4 w-4 mr-1 text-yellow-500" />
                <span className="text-xs">Light</span>
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setTheme('dark')}
                className={`${theme === 'dark' ? 'bg-muted border-primary' : 'border-muted'} flex items-center justify-center border shadow-sm`}
              >
                <Moon className="h-4 w-4 mr-1 text-blue-400" />
                <span className="text-xs">Dark</span>
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setTheme('system')}
                className={`${theme === 'system' ? 'bg-muted border-primary' : 'border-muted'} flex items-center justify-center border shadow-sm`}
              >
                <Laptop className="h-4 w-4 mr-1" />
                <span className="text-xs">System</span>
              </Button>
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
} 