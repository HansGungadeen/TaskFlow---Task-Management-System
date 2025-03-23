-- Migration: 006 - Initial User Synchronization

-- Execute the function to sync all existing users
SELECT sync_all_auth_users_to_public(); 