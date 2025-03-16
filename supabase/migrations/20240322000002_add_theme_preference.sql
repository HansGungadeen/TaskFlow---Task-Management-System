-- Add theme_preference column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS theme_preference VARCHAR(10) DEFAULT 'system';

-- Enable realtime for the users table
alter publication supabase_realtime add table users;
