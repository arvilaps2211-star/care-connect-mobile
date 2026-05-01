-- Chat messages between hospital and ambulance for an emergency
CREATE TABLE public.emergency_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emergency_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('hospital','ambulance','admin')),
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_emergency_messages_emergency ON public.emergency_messages(emergency_id, created_at);

ALTER TABLE public.emergency_messages ENABLE ROW LEVEL SECURITY;

-- Only responders (hospital/ambulance/admin) can view chat
CREATE POLICY "Responders can view chat"
ON public.emergency_messages FOR SELECT
USING (
  public.has_role(auth.uid(), 'hospital'::app_role)
  OR public.has_role(auth.uid(), 'ambulance'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Only responders can send messages, and sender_id must be themselves
CREATE POLICY "Responders can send chat"
ON public.emergency_messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND (
    public.has_role(auth.uid(), 'hospital'::app_role)
    OR public.has_role(auth.uid(), 'ambulance'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Mark-as-read updates
CREATE POLICY "Responders can update chat"
ON public.emergency_messages FOR UPDATE
USING (
  public.has_role(auth.uid(), 'hospital'::app_role)
  OR public.has_role(auth.uid(), 'ambulance'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Enable realtime
ALTER TABLE public.emergency_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_messages;