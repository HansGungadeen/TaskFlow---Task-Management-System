# TaskFlow Migration Guide

This guide provides the steps needed to migrate the TaskFlow application to a new Supabase project.

## Migration Options

You have two options for migration:

### Option 1: Using the Consolidated Migration Script (Recommended)

Run the entire database setup in one go:

1. Log in to your Supabase dashboard and open the SQL Editor
2. Copy the contents of `migration.sql` and execute it
3. This script contains all database tables, functions, policies, and permissions

### Option 2: Step-by-Step Migration

If you prefer to migrate in stages, you can follow these steps:

1. **Setup Database Schema and Tables**
   ```sql
   -- Run clean_start.sql first to set up the basic schema
   ```

2. **Fix Foreign Key Constraints**
   ```sql
   -- Run fix_foreign_key_v2.sql to create proper user synchronization
   ```

3. **Setup RLS Policies**
   ```sql
   -- Run fix_missing_notifications.sql to set up RLS for notifications
   ```

4. **Run Data Synchronization**
   ```sql
   -- Run fix_missing_users.sql to sync auth users to public users
   ```

## Application Setup

1. **Environment Variables**
   
   Create a `.env.local` file with the following:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

2. **Supabase Auth Configuration**
   
   In your Supabase dashboard:
   - Go to Authentication → Settings
   - Configure Site URL to match your deployment URL
   - Enable Email provider (and any other auth providers you need)
   - Set up redirect URLs if needed

3. **Storage Setup** (Optional)
   
   If your app uses file uploads:
   - Create appropriate storage buckets
   - Set up access policies

## Post-Migration Tasks

1. **Create Initial Admin User**
   - Register a user through the application
   - Use the SQL Editor to grant admin privileges if needed:
   ```sql
   UPDATE team_members 
   SET role = 'admin' 
   WHERE user_id = 'your-user-id' AND team_id = 'your-team-id';
   ```

2. **Verify Data Synchronization**
   - Check that users are properly synced:
   ```sql
   SELECT * FROM auth.users;
   SELECT * FROM public.users;
   ```

3. **Test Notifications**
   - Verify notifications are working by having a user mention another user

## Troubleshooting

### Foreign Key Constraint Errors

If you encounter foreign key constraint errors:
1. Check that the `sync_auth_user_to_public` function is working
2. Run this query to manually sync users:
   ```sql
   SELECT sync_all_auth_users_to_public();
   ```
3. Verify that RLS policies are properly applied

### Authentication Issues

If users have trouble logging in:
1. Check that your environment variables are correct
2. Verify the Site URL in Authentication settings matches your deployment URL
3. Check for any CORS errors in the browser console

### Notification Issues

If notifications aren't appearing:
1. Check that RLS policies are properly configured
2. Confirm that the notification functions have appropriate permissions
3. Use this function to verify notifications exist in the database:
   ```sql
   SELECT * FROM check_user_notifications('user-id-here');
   ``` 