
-- Enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'driver');

-- Enum for delivery status
CREATE TYPE public.delivery_status AS ENUM ('pendiente', 'aceptado', 'en_camino', 'entregado', 'cancelado');

-- Enum for driver status
CREATE TYPE public.driver_status AS ENUM ('activo', 'inactivo', 'suspendido', 'en_ruta');

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Driver profiles (extra info for drivers)
CREATE TABLE public.driver_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status driver_status NOT NULL DEFAULT 'inactivo',
  zone TEXT,
  current_load INTEGER NOT NULL DEFAULT 0,
  rating NUMERIC(2,1) DEFAULT 0,
  total_deliveries INTEGER NOT NULL DEFAULT 0,
  acceptance_rate NUMERIC(5,2) DEFAULT 100,
  cancellation_rate NUMERIC(5,2) DEFAULT 0,
  avg_delivery_time INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.driver_profiles ENABLE ROW LEVEL SECURITY;

-- Driver real-time locations
CREATE TABLE public.driver_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(driver_id)
);
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

-- Deliveries table
CREATE TABLE public.deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL,
  driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  pickup_address TEXT NOT NULL,
  pickup_lat DOUBLE PRECISION,
  pickup_lng DOUBLE PRECISION,
  delivery_address TEXT NOT NULL,
  delivery_lat DOUBLE PRECISION,
  delivery_lng DOUBLE PRECISION,
  status delivery_status NOT NULL DEFAULT 'pendiente',
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  commission NUMERIC(12,2) NOT NULL DEFAULT 0,
  estimated_time INTEGER,
  zone TEXT,
  is_delayed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

-- Delivery audit log
CREATE TABLE public.delivery_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID REFERENCES public.deliveries(id) ON DELETE CASCADE NOT NULL,
  event TEXT NOT NULL,
  details TEXT,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_audit_log ENABLE ROW LEVEL SECURITY;

-- Alerts table
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.deliveries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies

-- user_roles: users can read their own roles, admins can read all
CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- profiles: users can read/update own, admins can read all
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- driver_profiles: drivers can read/update own, admins can manage all
CREATE POLICY "Drivers can read own driver profile" ON public.driver_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Drivers can update own driver profile" ON public.driver_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can manage all driver profiles" ON public.driver_profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- driver_locations: drivers can upsert own, admins can read all
CREATE POLICY "Drivers can manage own location" ON public.driver_locations
  FOR ALL TO authenticated
  USING (driver_id = auth.uid());

CREATE POLICY "Admins can read all locations" ON public.driver_locations
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- deliveries: drivers see pending and assigned, admins see all
-- Drivers can read pending deliveries (only if they have driver role)
CREATE POLICY "Drivers can read pending deliveries" ON public.deliveries
  FOR SELECT TO authenticated
  USING (
    status = 'pendiente' AND public.has_role(auth.uid(), 'driver')
  );

-- Drivers can read their assigned deliveries
CREATE POLICY "Drivers can read own deliveries" ON public.deliveries
  FOR SELECT TO authenticated
  USING (driver_id = auth.uid());

-- Drivers can accept pending deliveries
CREATE POLICY "Drivers can accept deliveries" ON public.deliveries
  FOR UPDATE TO authenticated
  USING (
    status = 'pendiente' AND public.has_role(auth.uid(), 'driver')
  );

-- Drivers can update their own deliveries
CREATE POLICY "Drivers can update own deliveries" ON public.deliveries
  FOR UPDATE TO authenticated
  USING (driver_id = auth.uid());

-- Admins can read all deliveries
CREATE POLICY "Admins can read all deliveries" ON public.deliveries
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can insert/update/delete all deliveries
CREATE POLICY "Admins can manage all deliveries" ON public.deliveries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- delivery_audit_log: admins and involved drivers can read
CREATE POLICY "Admins can manage audit log" ON public.delivery_audit_log
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Drivers can read own audit entries" ON public.delivery_audit_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = delivery_id AND d.driver_id = auth.uid()
    )
  );

-- alerts: admins only
CREATE POLICY "Admins can manage alerts" ON public.alerts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
