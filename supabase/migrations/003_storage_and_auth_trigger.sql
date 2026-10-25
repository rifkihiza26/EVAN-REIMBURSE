-- ==============================================================================
-- Migration: 003_storage_and_auth_trigger.sql
-- Description: Private Storage bucket for receipts & automatic profile trigger
-- ==============================================================================

-- 1. SETUP PRIVATE STORAGE BUCKET FOR RECEIPTS
-- Note: Insert into storage.buckets if not already existing
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reimbursement-receipts',
  'reimbursement-receipts',
  false, -- WAJIB PRIVATE (PRD 8.4 & 9)
  10485760, -- 10 MB per file (PRD 5.4)
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'application/pdf'];

-- 2. STORAGE RLS POLICIES
-- Allow authenticated user to upload receipt into folder matching their employee_id: {employee_id}/{reimbursement_id}/{filename}
CREATE POLICY "Allow authenticated user to upload own receipts"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'reimbursement-receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow reading/downloading signed URLs for users who own the receipt or Bos
CREATE POLICY "Allow owner or boss to select receipts"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'reimbursement-receipts'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_boss()
    )
  );

-- 3. AUTOMATIC PROFILE CREATION TRIGGER ON SIGNUP
-- Helps keep auth.users in sync with public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    role,
    employee_code,
    is_active
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'employee'),
    NEW.raw_user_meta_data->>'employee_code',
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
