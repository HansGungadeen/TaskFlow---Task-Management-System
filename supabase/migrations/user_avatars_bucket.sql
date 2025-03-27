-- Create the user-avatars bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-avatars', 'user-avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own and public avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;

-- Policy for viewing avatars (public)
CREATE POLICY "Users can view their own and public avatars"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'user-avatars' AND
  (auth.uid() = owner OR owner IS NULL)
);

-- Policy for uploading avatars
CREATE POLICY "Users can upload avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-avatars' AND
  auth.uid() IS NOT NULL AND
  auth.uid() = owner
);

-- Policy for updating avatars
CREATE POLICY "Users can update their own avatars"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'user-avatars' AND
  auth.uid() = owner
);

-- Policy for deleting avatars
CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'user-avatars' AND
  auth.uid() = owner
);

-- Set RLS to true for storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; 