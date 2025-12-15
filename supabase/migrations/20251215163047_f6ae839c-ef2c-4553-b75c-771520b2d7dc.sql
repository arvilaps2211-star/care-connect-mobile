-- Create a function to register a hospital that bypasses RLS
CREATE OR REPLACE FUNCTION public.register_hospital(
  p_user_id uuid,
  p_hospital_name text,
  p_contact_number text,
  p_latitude numeric,
  p_longitude numeric,
  p_license_url text,
  p_certificate_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hospital_id uuid;
BEGIN
  -- Insert hospital record
  INSERT INTO public.hospitals (name, contact_number, latitude, longitude, user_id)
  VALUES (p_hospital_name, p_contact_number, p_latitude, p_longitude, p_user_id)
  RETURNING id INTO v_hospital_id;
  
  -- Insert verification record
  INSERT INTO public.hospital_verifications (hospital_id, user_id, license_url, certificate_url, status)
  VALUES (v_hospital_id, p_user_id, p_license_url, p_certificate_url, 'approved');
  
  -- Assign hospital role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'hospital');
  
  RETURN v_hospital_id;
END;
$$;