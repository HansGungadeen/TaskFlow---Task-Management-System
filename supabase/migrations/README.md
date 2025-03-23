# TaskFlow Migrations

This folder contains database migrations for the TaskFlow application. The migrations are organized in a sequential order and should be applied in the numeric order of their filenames.

## Migration Files

1. `20250323000001_schema_setup.sql` - Initial schema setup with tables and views
2. `20250323000002_foreign_key_fixes.sql` - Functions to fix foreign key constraint issues
3. `20250323000003_rls_policies.sql` - Row Level Security policies
4. `20250323000004_user_triggers.sql` - User synchronization triggers and utilities
5. `20250323000005_permissions.sql` - Permission and grant setup
6. `20250323000006_initial_sync.sql` - Initial user synchronization

## How to Apply Migrations

### Using Supabase CLI

If you're using the Supabase CLI, you can apply migrations with:

```bash
supabase db push
```

### Manual Application

To apply the migrations manually:

1. Connect to your Supabase SQL Editor
2. Apply each migration file in order
3. Verify the changes have been applied

## Schema Changes

If you need to make changes to the database schema:

1. Create a new migration file with the next sequential timestamp
2. Include both the changes and any necessary rollback commands
3. Test the migration in a development environment before applying to production

## Troubleshooting

If you encounter issues during migration:

1. Check that the migrations are being applied in the correct order
2. Verify that you have the necessary permissions
3. For foreign key errors, run the user synchronization function:
   ```sql
   SELECT sync_all_auth_users_to_public();
   ```
4. Check the Supabase logs for error details 