-- Create themes table
CREATE TABLE IF NOT EXISTS public.themes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  is_preset BOOLEAN DEFAULT false,
  colors JSONB NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create RLS policies for themes
ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;

-- Allow users to read any theme (presets are public, user themes are private)
CREATE POLICY "Users can read preset themes" 
  ON public.themes FOR SELECT 
  USING (is_preset = true OR created_by = auth.uid());

-- Allow users to insert their own themes
CREATE POLICY "Users can create their own themes" 
  ON public.themes FOR INSERT 
  WITH CHECK (created_by = auth.uid());

-- Allow users to update their own themes
CREATE POLICY "Users can update their own themes" 
  ON public.themes FOR UPDATE 
  USING (created_by = auth.uid());

-- Allow users to delete their own themes
CREATE POLICY "Users can delete their own themes" 
  ON public.themes FOR DELETE 
  USING (created_by = auth.uid());

-- Fix the theme_preference column type conversion:
-- First drop any default values
ALTER TABLE public.users 
  ALTER COLUMN theme_preference DROP DEFAULT;
  
-- Then convert to UUID type, explicitly setting NULL values
ALTER TABLE public.users 
  ALTER COLUMN theme_preference TYPE UUID USING NULL;
  
-- Add some default theme presets
INSERT INTO public.themes (name, description, is_preset, colors)
VALUES 
  ('Default Green', 'The default green theme', true, '{
    "primary": { "hue": 142.1, "saturation": 76.2, "lightness": 36.3 },
    "brand": { "hue": 142, "saturation": 76, "lightness": 45 }
  }'),
  ('Ocean Blue', 'A calming blue theme', true, '{
    "primary": { "hue": 210, "saturation": 70, "lightness": 40 },
    "brand": { "hue": 210, "saturation": 70, "lightness": 50 }
  }'),
  ('Sunset Orange', 'A warm orange theme', true, '{
    "primary": { "hue": 25, "saturation": 90, "lightness": 45 },
    "brand": { "hue": 25, "saturation": 90, "lightness": 55 }
  }'),
  ('Royal Purple', 'A rich purple theme', true, '{
    "primary": { "hue": 270, "saturation": 60, "lightness": 40 },
    "brand": { "hue": 270, "saturation": 60, "lightness": 50 }
  }'),
  ('Ruby Red', 'A bold red theme', true, '{
    "primary": { "hue": 0, "saturation": 70, "lightness": 40 },
    "brand": { "hue": 0, "saturation": 70, "lightness": 50 }
  }');

-- Create a function to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to call the function
CREATE TRIGGER update_themes_updated_at
BEFORE UPDATE ON public.themes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column(); 