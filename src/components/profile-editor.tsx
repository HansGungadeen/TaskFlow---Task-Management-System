"use client";

import { useState, useEffect, useTransition } from "react";
import { createClient } from "../../supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "./ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useToast } from "./ui/use-toast";
import { 
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue
} from "./ui/select";
import { Upload, User as UserIcon, Sun, Moon, Laptop, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { updateUserProfile } from "@/app/actions/profile";
import { useTheme } from "next-themes";

interface Theme {
  id: string;
  name: string;
  description: string | null;
  is_preset: boolean;
  colors: {
    primary: { hue: number; saturation: number; lightness: number };
    brand: { hue: number; saturation: number; lightness: number };
  };
}

interface UserProfile {
  id: string;
  name: string | null;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  theme_preference: string | null;
  created_at: string;
  updated_at: string | null;
}

interface ProfileEditorProps {
  user: UserProfile | null;
  authUser: User;
}

export default function ProfileEditor({ user, authUser }: ProfileEditorProps) {
  const supabase = createClient();
  const router = useRouter();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [isPending, startTransition] = useTransition();
  
  const [name, setName] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [displayMode, setDisplayMode] = useState<string>("system");
  const [themePreference, setThemePreference] = useState<string>("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [presetThemes, setPresetThemes] = useState<Theme[]>([]);
  
  // Load preset themes
  useEffect(() => {
    const loadThemes = async () => {
      try {
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
      } catch (error) {
        console.error("Error loading themes:", error);
      }
    };
    
    loadThemes();
  }, [supabase]);
  
  // Initialize form values from props
  useEffect(() => {
    const initializeValues = async () => {
      if (user) {
        setName(user.name || "");
        setFullName(user.full_name || "");
        setAvatarUrl(user.avatar_url || "");
        
        // Check if theme_preference is a UUID (color theme) or display mode
        const themePreference = user.theme_preference || "system";
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(themePreference);
        
        if (isUUID) {
          // It's a color theme
          setThemePreference(themePreference);
          
          // Check if we already have the theme loaded in presetThemes
          const foundTheme = presetThemes.find(t => t.id === themePreference);
          
          // If theme not found in presets but is a valid UUID, fetch it directly
          if (!foundTheme && presetThemes.length > 0) {
            try {
              const { data: themeData } = await supabase
                .from('themes')
                .select('*')
                .eq('id', themePreference)
                .single();
                
              if (themeData?.colors) {
                // Apply theme colors immediately
                applyThemeColors(themeData.colors);
              }
            } catch (error) {
              console.error("Error fetching theme:", error);
            }
          } else if (foundTheme) {
            // Apply theme colors from the already loaded preset
            applyThemeColors(foundTheme.colors);
          }
          
          // We don't know the display mode, so use whatever is current or default to system
          setDisplayMode(theme || "system");
        } else {
          // It's a display mode
          setDisplayMode(themePreference);
          // No color theme selected initially
          setThemePreference("");
        }
      } else if (authUser) {
        // Fallback to auth user data if available
        setName(authUser.user_metadata?.name || "");
        setFullName(authUser.user_metadata?.full_name || "");
        setAvatarUrl(authUser.user_metadata?.avatar_url || "");
        setDisplayMode(theme || "system");
        setThemePreference("");
      }
    };
    
    initializeValues();
  }, [user, authUser, theme, presetThemes, supabase]);
  
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
  
  // Handle theme change
  const handleThemeChange = (value: string) => {
    setThemePreference(value);
    
    // If it's a preset theme (UUID), apply its colors
    const selectedTheme = presetThemes.find(t => t.id === value);
    if (selectedTheme) {
      applyThemeColors(selectedTheme.colors);
    }
  };
  
  // Handle display mode change
  const handleDisplayModeChange = (value: string) => {
    setDisplayMode(value);
    setTheme(value);
  };
  
  // Handle avatar file change
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : null;
    if (file) {
      setAvatarFile(file);
      
      // Create a preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Create a FormData object to send to the server
    const formData = new FormData();
    formData.append("name", name);
    formData.append("full_name", fullName);
    formData.append("current_avatar_url", avatarUrl);
    
    // Save theme preference (UUID) if present, otherwise save display mode
    const preferenceToSave = themePreference || displayMode;
    formData.append("theme_preference", preferenceToSave);
    
    // Always include display mode in form data
    formData.append("display_mode", displayMode);
    
    if (avatarFile) {
      formData.append("avatar", avatarFile);
    }
    
    // Use the server action with a transition
    startTransition(async () => {
      const result = await updateUserProfile(formData);
      
      if (result.success) {
        toast({
          title: "Profile updated",
          description: "Your profile has been successfully updated.",
          variant: "default"
        });
        
        // Refresh to show updated data
        router.refresh();
      } else {
        toast({
          title: "Update failed",
          description: result.error || "There was an error updating your profile.",
          variant: "destructive"
        });
      }
    });
  };
  
  // Generate avatar fallback text
  const getInitials = (name: string): string => {
    if (!name) return "?";
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Avatar card */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Picture</CardTitle>
            <CardDescription>
              Upload a profile picture or avatar
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <Avatar className="h-32 w-32 mb-4">
              <AvatarImage src={avatarPreview || avatarUrl} />
              <AvatarFallback className="text-2xl">
                {getInitials(fullName || name)}
              </AvatarFallback>
            </Avatar>
            
            <Label 
              htmlFor="avatar-upload" 
              className="cursor-pointer bg-secondary hover:bg-secondary/80 text-secondary-foreground px-4 py-2 rounded-md flex items-center gap-2 text-sm"
            >
              <Upload size={16} />
              Upload Image
            </Label>
            <Input 
              id="avatar-upload" 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleAvatarChange}
            />
            
            <p className="text-xs text-muted-foreground mt-2">
              Recommended: Square JPG, PNG. Max 2MB.
            </p>
          </CardContent>
        </Card>
        
        {/* Profile information card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>
              Update your personal details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Display Name</Label>
              <Input 
                id="name" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your display name"
              />
              <p className="text-xs text-muted-foreground">
                This is the name displayed in the app interface
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="full-name">Full Name</Label>
              <Input 
                id="full-name" 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input 
                id="email" 
                value={authUser.email || ""} 
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                To change your email, please contact support
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="display-mode">Display Mode</Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleDisplayModeChange("light")}
                  className={`flex items-center justify-center space-x-2 px-3 py-2 rounded-md text-sm border shadow-sm ${
                    displayMode === "light" ? "bg-muted border-primary" : "hover:bg-muted/50 border-muted"
                  }`}
                >
                  <Sun size={16} className="text-yellow-500" />
                  <span>Light</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDisplayModeChange("dark")}
                  className={`flex items-center justify-center space-x-2 px-3 py-2 rounded-md text-sm border shadow-sm ${
                    displayMode === "dark" ? "bg-muted border-primary" : "hover:bg-muted/50 border-muted"
                  }`}
                >
                  <Moon size={16} className="text-blue-400" />
                  <span>Dark</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDisplayModeChange("system")}
                  className={`flex items-center justify-center space-x-2 px-3 py-2 rounded-md text-sm border shadow-sm ${
                    displayMode === "system" ? "bg-muted border-primary" : "hover:bg-muted/50 border-muted"
                  }`}
                >
                  <Laptop size={16} />
                  <span>System</span>
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Choose light, dark, or system-based display mode
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="color-theme">Color Theme</Label>
              <div className="border rounded-md">
                <Select value={themePreference} onValueChange={handleThemeChange}>
                  <SelectTrigger id="color-theme">
                    <SelectValue placeholder="Select a color theme">
                      {themePreference ? (
                        <div className="flex items-center">
                          <div 
                            className="w-4 h-4 rounded-full mr-2" 
                            style={{
                              backgroundColor: presetThemes.find(t => t.id === themePreference)?.colors ? 
                                `hsl(${presetThemes.find(t => t.id === themePreference)?.colors.primary.hue} ${presetThemes.find(t => t.id === themePreference)?.colors.primary.saturation}% ${presetThemes.find(t => t.id === themePreference)?.colors.primary.lightness}%)` : 
                                undefined
                            }}
                          />
                          <span>{presetThemes.find(t => t.id === themePreference)?.name || "Select a color theme"}</span>
                        </div>
                      ) : (
                        "Select a color theme"
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {presetThemes.map(theme => (
                      <SelectItem 
                        key={theme.id} 
                        value={theme.id} 
                        className="flex cursor-pointer"
                      >
                        <div className="flex items-center w-full">
                          <div 
                            className="w-4 h-4 rounded-full mr-2" 
                            style={{
                              backgroundColor: `hsl(${theme.colors.primary.hue} ${theme.colors.primary.saturation}% ${theme.colors.primary.lightness}%)`
                            }}
                          />
                          <span>{theme.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Choose a color theme for the application
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </form>
  );
} 