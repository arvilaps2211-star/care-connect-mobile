-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'hospital', 'ambulance', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete roles"
ON public.user_roles
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Update emergencies table to add notification fields
ALTER TABLE public.emergencies
ADD COLUMN notified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN guardian_notified BOOLEAN DEFAULT false;

-- Update hospitals table to add auth fields
ALTER TABLE public.hospitals
DROP COLUMN IF EXISTS email,
DROP COLUMN IF EXISTS password_hash;

ALTER TABLE public.hospitals
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update ambulance_services to add auth fields
ALTER TABLE public.ambulance_services
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- RLS for hospitals (authenticated hospital users can view and update)
CREATE POLICY "Hospitals can view all hospitals"
ON public.hospitals
FOR SELECT
USING (public.has_role(auth.uid(), 'hospital') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Hospitals can update own data"
ON public.hospitals
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can insert hospitals"
ON public.hospitals
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete hospitals"
ON public.hospitals
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- RLS for ambulance_services
CREATE POLICY "Ambulances can view all ambulances"
ON public.ambulance_services
FOR SELECT
USING (public.has_role(auth.uid(), 'ambulance') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Ambulances can update own data"
ON public.ambulance_services
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can insert ambulances"
ON public.ambulance_services
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete ambulances"
ON public.ambulance_services
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Update emergency RLS to allow hospitals/ambulances to view and update
CREATE POLICY "Hospitals and ambulances can view active emergencies"
ON public.emergencies
FOR SELECT
USING (
  status = 'active' 
  AND (public.has_role(auth.uid(), 'hospital') OR public.has_role(auth.uid(), 'ambulance') OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Hospitals can accept emergencies"
ON public.emergencies
FOR UPDATE
USING (public.has_role(auth.uid(), 'hospital') OR public.has_role(auth.uid(), 'ambulance'))
WITH CHECK (public.has_role(auth.uid(), 'hospital') OR public.has_role(auth.uid(), 'ambulance'));