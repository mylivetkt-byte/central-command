
-- Update driver_profiles
ALTER TABLE public.driver_profiles 
  DROP CONSTRAINT IF EXISTS driver_profiles_id_fkey,
  ADD CONSTRAINT driver_profiles_id_fkey FOREIGN KEY (id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Add email column to profiles if it doesn't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Update driver_locations
ALTER TABLE public.driver_locations 
  DROP CONSTRAINT IF EXISTS driver_locations_driver_id_fkey,
  ADD CONSTRAINT driver_locations_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Update deliveries (driver_id)
ALTER TABLE public.deliveries 
  DROP CONSTRAINT IF EXISTS deliveries_driver_id_fkey,
  ADD CONSTRAINT deliveries_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Update handle_new_user to auto-assign roles and create driver profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert into profiles
  INSERT INTO public.profiles (id, full_name, phone, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email;
  
  -- Auto-assign role if present in metadata
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, (NEW.raw_user_meta_data->>'role')::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- If it's a driver, also create driver_profile
  IF NEW.raw_user_meta_data->>'role' = 'driver' THEN
    INSERT INTO public.driver_profiles (id)
    VALUES (NEW.id)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure RLS allows these joins
-- Usually public.profiles is readable by authenticated users (already in policies)
