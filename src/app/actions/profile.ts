"use server";

import { createClient } from "../../../supabase/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

interface ProfileFormState {
  message: string;
  errors: {
    displayName?: string[];
    fullName?: string[];
    email?: string[];
    themePreference?: string[];
  };
}

export async function updateUserProfile(formData: FormData) {
  const supabase = await createClient();
  
  // Get the current user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { success: false, error: "You must be logged in to update your profile" };
  }
  
  try {
    // Extract the form data
    const name = formData.get("name") as string | null;
    const fullName = formData.get("full_name") as string | null;
    const themePreference = formData.get("theme_preference") as string | null;
    const displayMode = formData.get("display_mode") as string | null;
    
    // Handle avatar file if present
    const avatarFile = formData.get("avatar") as File | null;
    let avatarUrl = formData.get("current_avatar_url") as string | null;
    
    if (avatarFile && avatarFile.size > 0) {
      try {
        // First check if bucket exists
        const { data: bucketList } = await supabase
          .storage
          .listBuckets();
          
        const bucketExists = bucketList?.some(bucket => bucket.name === 'user-avatars');
        
        // Only try to create the bucket if it doesn't exist
        if (!bucketExists) {
          try {
            await supabase
              .storage
              .createBucket('user-avatars', {
                public: true,
                fileSizeLimit: 2097152, // 2MB in bytes
                allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
              });
          } catch (bucketError: any) {
            // If bucket creation fails, but it's not because it already exists, handle gracefully
            if (!bucketError.message?.includes('already exists')) {
              console.error('Failed to create bucket:', bucketError);
            }
          }
        }
      
        // Upload the file
        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase
          .storage
          .from('user-avatars')
          .upload(filePath, avatarFile, { upsert: true });
          
        if (uploadError) {
          if (uploadError.message?.includes('new row violates row-level security policy')) {
            return { 
              success: false, 
              error: "Permission denied when uploading avatar. Please contact the administrator to set up proper storage permissions."
            };
          }
          return { success: false, error: `Failed to upload avatar: ${uploadError.message}` };
        }

        // Get the public URL
        const { data: publicUrlData } = supabase
          .storage
          .from('user-avatars')
          .getPublicUrl(filePath);
          
        avatarUrl = publicUrlData.publicUrl;
      } catch (storageError: any) {
        console.error('Storage error:', storageError);
        return { success: false, error: `Storage error: ${storageError.message}` };
      }
    }
    
    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString()
    };
    
    if (name !== null) updateData.name = name;
    if (fullName !== null) updateData.full_name = fullName;
    if (avatarUrl !== null) updateData.avatar_url = avatarUrl;
    
    // Handle theme preference
    // Check if theme_preference is a valid UUID or a display mode
    const isValidUUID = themePreference ? 
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(themePreference) : 
      false;
      
    const validDisplayModes = ['light', 'dark', 'system'];
    
    // Determine what to save as theme_preference
    if (themePreference !== null) {
      // If it's a UUID (color theme) or a valid display mode, save it directly
      if (isValidUUID || validDisplayModes.includes(themePreference)) {
        updateData.theme_preference = themePreference;
      }
      // If display_mode is provided and theme_preference isn't valid, use display_mode
      else if (displayMode && validDisplayModes.includes(displayMode)) {
        updateData.theme_preference = displayMode;
      }
    }
    
    // Update user profile
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
    revalidatePath('/');
    
    return { success: true };
  } catch (error: any) {
    console.error('Error in updateUserProfile:', error);
    return { success: false, error: error.message || "An unknown error occurred" };
  }
} 