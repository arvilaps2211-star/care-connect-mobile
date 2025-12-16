-- Add dispatched status and ambulance relationship fields
-- First, let's create a linking table for hospital-managed ambulances
CREATE TABLE IF NOT EXISTS public.hospital_ambulances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid REFERENCES public.hospitals(id) ON DELETE CASCADE NOT NULL,
  ambulance_id uuid REFERENCES public.ambulance_services(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(hospital_id, ambulance_id)
);

-- Enable RLS
ALTER TABLE public.hospital_ambulances ENABLE ROW LEVEL SECURITY;

-- Policies for hospital_ambulances
CREATE POLICY "Hospitals can view their ambulances"
ON public.hospital_ambulances FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.hospitals h
    WHERE h.id = hospital_ambulances.hospital_id
    AND h.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Hospitals can add ambulances"
ON public.hospital_ambulances FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.hospitals h
    WHERE h.id = hospital_ambulances.hospital_id
    AND h.user_id = auth.uid()
  )
);

CREATE POLICY "Hospitals can remove ambulances"
ON public.hospital_ambulances FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.hospitals h
    WHERE h.id = hospital_ambulances.hospital_id
    AND h.user_id = auth.uid()
  )
);

-- Allow hospitals to insert ambulance services (for their managed ambulances)
DROP POLICY IF EXISTS "Admins can insert ambulances" ON public.ambulance_services;
CREATE POLICY "Hospitals and admins can insert ambulances"
ON public.ambulance_services FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'hospital'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
);

-- Update emergencies to track dispatched status
-- Add column for tracking which hospital dispatched to which ambulance
ALTER TABLE public.emergencies ADD COLUMN IF NOT EXISTS dispatched_to_ambulance uuid REFERENCES public.ambulance_services(id);

-- Create function to register ambulance under hospital
CREATE OR REPLACE FUNCTION public.register_ambulance_for_hospital(
  p_hospital_id uuid,
  p_service_name text,
  p_contact_number text,
  p_latitude numeric,
  p_longitude numeric,
  p_vehicle_number text DEFAULT NULL,
  p_driver_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ambulance_id uuid;
BEGIN
  -- Insert ambulance service record
  INSERT INTO public.ambulance_services (name, contact_number, latitude, longitude)
  VALUES (p_service_name, p_contact_number, p_latitude, p_longitude)
  RETURNING id INTO v_ambulance_id;
  
  -- Link ambulance to hospital
  INSERT INTO public.hospital_ambulances (hospital_id, ambulance_id)
  VALUES (p_hospital_id, v_ambulance_id);
  
  RETURN v_ambulance_id;
END;
$$;