-- Add vehicle_type column to driver_profiles (was missing from original schema)
ALTER TABLE public.driver_profiles
  ADD COLUMN IF NOT EXISTS vehicle_type TEXT;
