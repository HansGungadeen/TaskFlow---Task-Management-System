-- Disable RLS on users table to allow insertions during signup
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Create policy for users table to allow all operations
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON users;
CREATE POLICY "Allow all operations for authenticated users"
ON users
FOR ALL
USING (auth.uid() = id);

-- Create policy for public read access
DROP POLICY IF EXISTS "Public read access" ON users;
CREATE POLICY "Public read access"
ON users
FOR SELECT
USING (true);
