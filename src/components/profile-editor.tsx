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
  SelectItem,
  SelectTrigger,
  SelectValue
} from "./ui/select";
import { Upload, User as UserIcon, Sun, Moon, Laptop } from "lucide-react";
import { useRouter } from "next/navigation";
import { updateUserProfile } from "@/app/actions/profile";

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
  const [isPending, startTransition] = useTransition();
  
  const [name, setName] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [themePreference, setThemePreference] = useState<string>("system");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  
  // Initialize form values from props
  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setFullName(user.full_name || "");
      setAvatarUrl(user.avatar_url || "");
      setThemePreference(user.theme_preference || "system");
    } else if (authUser) {
      // Fallback to auth user data if available
      setName(authUser.user_metadata?.name || "");
      setFullName(authUser.user_metadata?.full_name || "");
      setAvatarUrl(authUser.user_metadata?.avatar_url || "");
    }
  }, [user, authUser]);
  
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
    formData.append("theme_preference", themePreference);
    
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
              <Label htmlFor="theme">Theme Preference</Label>
              <Select 
                value={themePreference} 
                onValueChange={setThemePreference}
              >
                <SelectTrigger id="theme">
                  <SelectValue placeholder="Select a theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light" className="flex items-center gap-2">
                    <Sun size={16} className="text-yellow-500" />
                    <span>Light</span>
                  </SelectItem>
                  <SelectItem value="dark" className="flex items-center gap-2">
                    <Moon size={16} className="text-blue-400" />
                    <span>Dark</span>
                  </SelectItem>
                  <SelectItem value="system" className="flex items-center gap-2">
                    <Laptop size={16} />
                    <span>System</span>
                  </SelectItem>
                </SelectContent>
              </Select>
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
            <Button 
              type="submit" 
              disabled={isPending}
            >
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </form>
  );
} 