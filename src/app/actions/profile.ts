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
      try {
        // First check if bucket exists
        const { data: bucketList } = await supabase
          .storage
          .listBuckets();
          
        const bucketExists = bucketList?.some(bucket => bucket.name === 'user-avatars');
        
        // Only try to create the bucket if it doesn't exist
        if (!bucketExists) {
          // Use service role for bucket creation to bypass RLS
          // This requires proper setup in your middleware or server environment
          // If you don't have access to serviceRoleClient, you will need to create the bucket manually in Supabase dashboard
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
              // Continue anyway as the bucket might exist but not be visible to the current user
            }
          }
        }
      
        // Upload the file - this should work even if we couldn't create the bucket (as long as it exists)
        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase
          .storage
          .from('user-avatars')
          .upload(filePath, avatarFile, { upsert: true });
          
        if (uploadError) {
          // If upload fails due to RLS, try another approach
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