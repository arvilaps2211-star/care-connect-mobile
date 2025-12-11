-- Create table for FCM tokens to store push notification tokens
CREATE TABLE public.fcm_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL,
  device_type text NOT NULL DEFAULT 'web',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, token)
);

-- Enable RLS
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Policies for FCM tokens
CREATE POLICY "Users can insert own tokens"
ON public.fcm_tokens FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens"
ON public.fcm_tokens FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tokens"
ON public.fcm_tokens FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Users can view own tokens"
ON public.fcm_tokens FOR SELECT
USING (auth.uid() = user_id);

-- Admin can view all tokens for sending notifications
CREATE POLICY "Admin can view all tokens"
ON public.fcm_tokens FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for emergencies
ALTER PUBLICATION supabase_realtime ADD TABLE public.emergencies;