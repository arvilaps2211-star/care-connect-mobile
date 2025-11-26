-- Create profiles table for user personal information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  age INTEGER,
  gender TEXT,
  address TEXT,
  vehicle_number TEXT,
  phone TEXT NOT NULL,
  remarks TEXT,
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create medical_info table
CREATE TABLE public.medical_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  blood_group TEXT,
  medical_history TEXT,
  additional_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create guardians table (multiple per user)
CREATE TABLE public.guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  contact_number TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create emergencies table
CREATE TABLE public.emergencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  status TEXT DEFAULT 'active', -- active, resolved, false_alarm
  accepted_by_hospital UUID,
  accepted_by_ambulance UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Create hospitals table
CREATE TABLE public.hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  contact_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create ambulance_services table
CREATE TABLE public.ambulance_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_number TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambulance_services ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for medical_info
CREATE POLICY "Users can view own medical info" ON public.medical_info
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own medical info" ON public.medical_info
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own medical info" ON public.medical_info
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for guardians
CREATE POLICY "Users can view own guardians" ON public.guardians
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own guardians" ON public.guardians
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own guardians" ON public.guardians
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own guardians" ON public.guardians
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for emergencies
CREATE POLICY "Users can view own emergencies" ON public.emergencies
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own emergencies" ON public.emergencies
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Hospitals can view all active emergencies
CREATE POLICY "Public can view active emergencies" ON public.emergencies
  FOR SELECT USING (status = 'active');

-- Public read for hospitals (for dashboard)
CREATE POLICY "Public can view hospitals" ON public.hospitals
  FOR SELECT USING (true);

-- Public read for ambulance services
CREATE POLICY "Public can view ambulance services" ON public.ambulance_services
  FOR SELECT USING (true);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER medical_info_updated_at
  BEFORE UPDATE ON public.medical_info
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();