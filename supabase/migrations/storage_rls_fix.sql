-- Fix for storage bucket RLS issues
-- This script adds proper RLS policies for the user-avatars bucket

-- First, create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES ('user-avatars', 'user-avatars', true, false, 2097152, '{image/png,image/jpeg,image/gif,image/webp}')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on objects table if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to upload their own avatar
CREATE POLICY "Users can upload their own avatars" ON storage.objects
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    bucket_id = 'user-avatars' AND 
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Create policy to allow users to update/delete their own avatar
CREATE POLICY "Users can update or delete their own avatars" ON storage.objects
  FOR UPDATE 
  TO authenticated
  USING (
    bucket_id = 'user-avatars' AND 
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Create policy to allow users to delete their own avatar
CREATE POLICY "Users can delete their own avatars" ON storage.objects
  FOR DELETE 
  TO authenticated
  USING (
    bucket_id = 'user-avatars' AND 
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Create policy to allow users to select/view their own avatar
CREATE POLICY "Users can view their own avatars" ON storage.objects
  FOR SELECT 
  TO authenticated
  USING (
    bucket_id = 'user-avatars' AND 
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Create policy to allow everyone to view public avatars
CREATE POLICY "Public users can view avatars" ON storage.objects
  FOR SELECT 
  TO anon, authenticated
  USING (
    bucket_id = 'user-avatars'
  );

-- Allow service_role to access all storage objects
CREATE POLICY "Service role has full access to all objects" ON storage.objects
  FOR ALL 
  TO service_role
  USING (true); 