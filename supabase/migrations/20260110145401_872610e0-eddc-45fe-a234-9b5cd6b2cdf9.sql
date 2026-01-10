-- Deduplicate profiles by user_id (keep the most recently updated/created)
WITH ranked AS (
  SELECT id,
         user_id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id
           ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM public.profiles
)
DELETE FROM public.profiles p
USING ranked r
WHERE p.id = r.id
  AND r.rn > 1;

-- Ensure one profile per user
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_user_id_unique'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

-- Deduplicate medical_info by user_id (keep the most recently updated/created)
WITH ranked AS (
  SELECT id,
         user_id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id
           ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM public.medical_info
)
DELETE FROM public.medical_info m
USING ranked r
WHERE m.id = r.id
  AND r.rn > 1;

-- Ensure one medical_info row per user
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'medical_info_user_id_unique'
  ) THEN
    ALTER TABLE public.medical_info
      ADD CONSTRAINT medical_info_user_id_unique UNIQUE (user_id);
  END IF;
END $$;