-- Create table for hospital verification documents
CREATE TABLE public.hospital_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hospital_id UUID REFERENCES public.hospitals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  license_url TEXT NOT NULL,
  certificate_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  verified_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.hospital_verifications ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Hospitals can view own verification"
ON public.hospital_verifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Hospitals can insert own verification"
ON public.hospital_verifications FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all verifications"
ON public.hospital_verifications FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update verifications"
ON public.hospital_verifications FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Create storage bucket for hospital documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('hospital-documents', 'hospital-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Hospitals can upload documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'hospital-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Hospitals can view own documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'hospital-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all hospital documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'hospital-documents' AND has_role(auth.uid(), 'admin'));