"use server";

import { createClient } from "../../../supabase/server";
import { revalidatePath } from "next/cache";

interface ProfileUpdateData {
  name?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  theme_preference?: string | null;
  updated_at?: string;
}

export async function updateUserProfile(formData: FormData) {
  const supabase = await createClient();
  
  // Get the current user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }
  
  try {
    // Extract the form data
    const name = formData.get("name") as string | null;
    const fullName = formData.get("full_name") as string | null;
    const themePreference = formData.get("theme_preference") as string | null;
    
    // Handle avatar file if present
    const avatarFile = formData.get("avatar") as File | null;
    let avatarUrl = formData.get("current_avatar_url") as string | null;
    
    if (avatarFile && avatarFile.size > 0) {
      // Create the bucket if it doesn't exist
      const { data: bucketData, error: bucketError } = await supabase
        .storage
        .createBucket('user-avatars', {
          public: true,
          fileSizeLimit: 2097152, // 2MB in bytes
          allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
        });
        
      if (bucketError && !bucketError.message.includes('already exists')) {
        return { success: false, error: `Failed to create storage bucket: ${bucketError.message}` };
      }
      
      // Upload the file
      const fileExt = avatarFile.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase
        .storage
        .from('user-avatars')
        .upload(filePath, avatarFile, { upsert: true });
        
      if (uploadError) {
        return { success: false, error: `Failed to upload avatar: ${uploadError.message}` };
      }
      
      // Get the public URL
      const { data: publicUrlData } = supabase
        .storage
        .from('user-avatars')
        .getPublicUrl(filePath);
        
      avatarUrl = publicUrlData.publicUrl;
    }
    
    // Update the user profile
    const updateData: ProfileUpdateData = {
      updated_at: new Date().toISOString()
    };
    
    if (name !== null) updateData.name = name;
    if (fullName !== null) updateData.full_name = fullName;
    if (avatarUrl !== null) updateData.avatar_url = avatarUrl;
    if (themePreference !== null) updateData.theme_preference = themePreference;
    
    const { error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', user.id);
      
    if (updateError) {
      return { success: false, error: `Failed to update profile: ${updateError.message}` };
    }
    
    // Also update user metadata to keep it synced
    await supabase.auth.updateUser({
      data: {
        name: name || undefined,
        full_name: fullName || undefined,
        avatar_url: avatarUrl || undefined
      }
    });
    
    // Revalidate the profile page
    revalidatePath('/dashboard/profile');
    
    return { success: true };
  } catch (error: any) {
    console.error('Error in updateUserProfile:', error);
    return { success: false, error: error.message || "An unknown error occurred" };
  }
} 