-- This migration handles updating existing theme_preference values to match the new UUID-based system

-- Get the theme ID for the default green theme
DO $$
DECLARE 
  default_green_theme_id UUID;
  light_theme_id UUID;
  dark_theme_id UUID;
BEGIN
  -- Find the default green theme
  SELECT id INTO default_green_theme_id 
  FROM themes 
  WHERE name = 'Default Green' AND is_preset = true;
  
  -- Find the ocean theme to use for 'light' preference
  SELECT id INTO light_theme_id 
  FROM themes 
  WHERE name = 'Ocean Blue' AND is_preset = true;
  
  -- Find the purple theme to use for 'dark' preference
  SELECT id INTO dark_theme_id 
  FROM themes 
  WHERE name = 'Royal Purple' AND is_preset = true;

  -- Update users with 'system' theme preference to use the default green theme
  UPDATE users
  SET theme_preference = default_green_theme_id
  WHERE theme_preference IS NULL;
  
  -- We can't easily determine which users had 'light' or 'dark' previously
  -- since the column has been converted to UUID, but if needed we could
  -- add logic here to map specific users to specific themes
END;
$$; 