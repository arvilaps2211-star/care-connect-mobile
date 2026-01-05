-- Allow hospitals and admins to view profiles for emergency response
CREATE POLICY "Hospitals and admins can view profiles for emergencies"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'hospital'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'ambulance'::app_role)
);

-- Also allow viewing medical info for emergency response
CREATE POLICY "Hospitals and admins can view medical info for emergencies"
ON public.medical_info
FOR SELECT
USING (
  has_role(auth.uid(), 'hospital'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'ambulance'::app_role)
);

-- Allow hospitals and admins to view guardian info for emergencies
CREATE POLICY "Hospitals and admins can view guardians for emergencies"
ON public.guardians
FOR SELECT
USING (
  has_role(auth.uid(), 'hospital'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'ambulance'::app_role)
);