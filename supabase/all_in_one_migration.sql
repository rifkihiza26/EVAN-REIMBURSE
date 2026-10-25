-- ==============================================================================
-- ALL-IN-ONE MIGRATION & SEED FOR EMPLOYEE REIMBURSEMENT
-- Jalankan seluruh isi skrip ini sekali jalan di Supabase SQL Editor
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('boss', 'employee')),
  employee_code TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_employee_code ON public.profiles(employee_code) WHERE employee_code IS NOT NULL;

-- 3. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name ON public.categories(LOWER(name));

-- 4. REIMBURSEMENTS TABLE & SEQUENCE
CREATE SEQUENCE IF NOT EXISTS public.claim_number_seq START WITH 1001;

CREATE TABLE IF NOT EXISTS public.reimbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_number TEXT NOT NULL UNIQUE,
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  expense_date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payment_source TEXT NOT NULL CHECK (payment_source IN ('personal', 'company')),
  description TEXT NOT NULL,
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('draft', 'pending', 'revision', 'approved', 'rejected', 'cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid')),
  submitted_at TIMESTAMPTZ NULL,
  decided_at TIMESTAMPTZ NULL,
  decided_by UUID NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reimbursements_employee ON public.reimbursements(employee_id);
CREATE INDEX IF NOT EXISTS idx_reimbursements_status ON public.reimbursements(approval_status, payment_status);
CREATE INDEX IF NOT EXISTS idx_reimbursements_date ON public.reimbursements(expense_date);
CREATE INDEX IF NOT EXISTS idx_reimbursements_category ON public.reimbursements(category_id);
CREATE INDEX IF NOT EXISTS idx_reimbursements_claim_no ON public.reimbursements(claim_number);

-- 5. REIMBURSEMENT FILES TABLE
CREATE TABLE IF NOT EXISTS public.reimbursement_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reimbursement_id UUID NOT NULL REFERENCES public.reimbursements(id) ON DELETE RESTRICT,
  storage_path TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0),
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reimbursement_files_reimbursement ON public.reimbursement_files(reimbursement_id);

-- 6. APPROVAL HISTORY TABLE (Append-Only)
CREATE TABLE IF NOT EXISTS public.approval_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reimbursement_id UUID NOT NULL REFERENCES public.reimbursements(id) ON DELETE RESTRICT,
  actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('created', 'submitted', 'resubmitted', 'revision_requested', 'approved', 'rejected', 'cancelled', 'payment_recorded')),
  note TEXT NULL,
  previous_status TEXT NULL,
  new_status TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_history_reimbursement ON public.approval_history(reimbursement_id, created_at ASC);

-- 7. PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reimbursement_id UUID NOT NULL UNIQUE REFERENCES public.reimbursements(id) ON DELETE RESTRICT,
  recorded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount_paid NUMERIC(14,2) NOT NULL CHECK (amount_paid > 0),
  paid_at DATE NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer')),
  reference_number TEXT NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON public.payments(paid_at);

-- 8. HELPER TRIGGERS & CLAIM NUMBER GENERATOR
CREATE OR REPLACE FUNCTION public.generate_claim_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  seq_val BIGINT;
  prefix TEXT;
BEGIN
  seq_val := nextval('public.claim_number_seq');
  prefix := 'RMB-' || to_char(now(), 'YYYYMM') || '-' || lpad(seq_val::text, 4, '0');
  RETURN prefix;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_profiles_updated_at ON public.profiles;
CREATE TRIGGER tr_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_categories_updated_at ON public.categories;
CREATE TRIGGER tr_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_reimbursements_updated_at ON public.reimbursements;
CREATE TRIGGER tr_reimbursements_updated_at
  BEFORE UPDATE ON public.reimbursements
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 9. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reimbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reimbursement_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_boss()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'boss' AND is_active = true
  );
$$;

-- Drop existing policies if re-running
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
  DROP POLICY IF EXISTS "Boss can read all profiles" ON public.profiles;
  DROP POLICY IF EXISTS "Users can update own name" ON public.profiles;
  DROP POLICY IF EXISTS "Boss can update employee profiles" ON public.profiles;
  DROP POLICY IF EXISTS "Authenticated users can view active categories" ON public.categories;
  DROP POLICY IF EXISTS "Boss can manage categories" ON public.categories;
  DROP POLICY IF EXISTS "Employees can view own reimbursements" ON public.reimbursements;
  DROP POLICY IF EXISTS "Employees can insert own reimbursement" ON public.reimbursements;
  DROP POLICY IF EXISTS "Employees can update own draft or revision reimbursement" ON public.reimbursements;
  DROP POLICY IF EXISTS "Boss can update reimbursements" ON public.reimbursements;
  DROP POLICY IF EXISTS "Users can view files of authorized reimbursements" ON public.reimbursement_files;
  DROP POLICY IF EXISTS "Employees can insert files for own reimbursements" ON public.reimbursement_files;
  DROP POLICY IF EXISTS "Users can view approval history of authorized reimbursements" ON public.approval_history;
  DROP POLICY IF EXISTS "Users can append approval history" ON public.approval_history;
  DROP POLICY IF EXISTS "Users can view authorized payments" ON public.payments;
  DROP POLICY IF EXISTS "Only Boss can record payments" ON public.payments;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Policies
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Boss can read all profiles" ON public.profiles FOR SELECT USING (public.is_boss());
CREATE POLICY "Users can update own name" ON public.profiles FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    AND is_active = (SELECT is_active FROM public.profiles WHERE id = auth.uid())
  );
CREATE POLICY "Boss can update employee profiles" ON public.profiles FOR UPDATE USING (public.is_boss());

CREATE POLICY "Authenticated users can view active categories" ON public.categories FOR SELECT TO authenticated
  USING (is_active = true OR public.is_boss());
CREATE POLICY "Boss can manage categories" ON public.categories FOR ALL TO authenticated
  USING (public.is_boss()) WITH CHECK (public.is_boss());

CREATE POLICY "Employees can view own reimbursements" ON public.reimbursements FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR public.is_boss());
CREATE POLICY "Employees can insert own reimbursement" ON public.reimbursements FOR INSERT TO authenticated
  WITH CHECK (
    employee_id = auth.uid()
    AND approval_status IN ('draft', 'pending')
    AND payment_status = 'unpaid'
  );
CREATE POLICY "Employees can update own draft or revision reimbursement" ON public.reimbursements FOR UPDATE TO authenticated
  USING (
    employee_id = auth.uid()
    AND approval_status IN ('draft', 'revision')
  )
  WITH CHECK (
    employee_id = auth.uid()
    AND approval_status IN ('draft', 'pending', 'cancelled')
  );
CREATE POLICY "Boss can update reimbursements" ON public.reimbursements FOR UPDATE TO authenticated
  USING (public.is_boss());

CREATE POLICY "Users can view files of authorized reimbursements" ON public.reimbursement_files FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reimbursements r
      WHERE r.id = reimbursement_files.reimbursement_id
      AND (r.employee_id = auth.uid() OR public.is_boss())
    )
  );
CREATE POLICY "Employees can insert files for own reimbursements" ON public.reimbursement_files FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.reimbursements r
      WHERE r.id = reimbursement_files.reimbursement_id
      AND r.employee_id = auth.uid()
      AND r.approval_status IN ('draft', 'pending', 'revision')
    )
  );

CREATE POLICY "Users can view approval history of authorized reimbursements" ON public.approval_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reimbursements r
      WHERE r.id = approval_history.reimbursement_id
      AND (r.employee_id = auth.uid() OR public.is_boss())
    )
  );
CREATE POLICY "Users can append approval history" ON public.approval_history FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

CREATE POLICY "Users can view authorized payments" ON public.payments FOR SELECT TO authenticated
  USING (
    public.is_boss()
    OR EXISTS (
      SELECT 1 FROM public.reimbursements r
      WHERE r.id = payments.reimbursement_id
      AND r.employee_id = auth.uid()
    )
  );
CREATE POLICY "Only Boss can record payments" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (public.is_boss() AND recorded_by = auth.uid());

-- 10. ATOMIC RPC FUNCTIONS
CREATE OR REPLACE FUNCTION public.submit_reimbursement(p_reimbursement_id UUID, p_note TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_r RECORD;
  v_action TEXT;
  v_prev_status TEXT;
  v_file_count INT;
BEGIN
  SELECT * INTO v_r FROM public.reimbursements WHERE id = p_reimbursement_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Klaim tidak ditemukan'; END IF;
  IF v_r.employee_id <> auth.uid() THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  IF v_r.approval_status NOT IN ('draft', 'revision') THEN RAISE EXCEPTION 'Status tidak valid untuk dikirim'; END IF;

  SELECT COUNT(*) INTO v_file_count FROM public.reimbursement_files WHERE reimbursement_id = p_reimbursement_id;
  IF v_file_count = 0 THEN RAISE EXCEPTION 'Klaim wajib memiliki minimal 1 bukti transaksi'; END IF;

  v_prev_status := v_r.approval_status;
  v_action := CASE WHEN v_r.approval_status = 'draft' THEN 'submitted' ELSE 'resubmitted' END;

  UPDATE public.reimbursements SET approval_status = 'pending', submitted_at = now(), updated_at = now() WHERE id = p_reimbursement_id;
  INSERT INTO public.approval_history (reimbursement_id, actor_id, action, note, previous_status, new_status)
  VALUES (p_reimbursement_id, auth.uid(), v_action, p_note, v_prev_status, 'pending');

  RETURN jsonb_build_object('success', true, 'status', 'pending');
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_reimbursement(p_reimbursement_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_r RECORD;
BEGIN
  SELECT * INTO v_r FROM public.reimbursements WHERE id = p_reimbursement_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Klaim tidak ditemukan'; END IF;
  IF v_r.employee_id <> auth.uid() THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  IF v_r.approval_status NOT IN ('draft', 'pending') THEN RAISE EXCEPTION 'Status tidak bisa dibatalkan'; END IF;

  UPDATE public.reimbursements SET approval_status = 'cancelled', updated_at = now() WHERE id = p_reimbursement_id;
  INSERT INTO public.approval_history (reimbursement_id, actor_id, action, note, previous_status, new_status)
  VALUES (p_reimbursement_id, auth.uid(), 'cancelled', p_reason, v_r.approval_status, 'cancelled');

  RETURN jsonb_build_object('success', true, 'status', 'cancelled');
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_reimbursement(p_reimbursement_id UUID, p_decision TEXT, p_note TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_r RECORD;
  v_new_status TEXT;
  v_action TEXT;
BEGIN
  IF NOT public.is_boss() THEN RAISE EXCEPTION 'Hanya Bos yang berwenang'; END IF;
  SELECT * INTO v_r FROM public.reimbursements WHERE id = p_reimbursement_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Klaim tidak ditemukan'; END IF;
  IF v_r.approval_status <> 'pending' THEN RAISE EXCEPTION 'Klaim bukan berstatus pending'; END IF;

  IF p_decision = 'approved' THEN
    v_new_status := 'approved'; v_action := 'approved';
  ELSIF p_decision = 'rejected' THEN
    IF p_note IS NULL OR trim(p_note) = '' THEN RAISE EXCEPTION 'Alasan wajib diisi saat menolak klaim'; END IF;
    v_new_status := 'rejected'; v_action := 'rejected';
  ELSIF p_decision = 'revision_requested' THEN
    IF p_note IS NULL OR trim(p_note) = '' THEN RAISE EXCEPTION 'Catatan revisi wajib diisi'; END IF;
    v_new_status := 'revision'; v_action := 'revision_requested';
  ELSE RAISE EXCEPTION 'Keputusan tidak valid'; END IF;

  UPDATE public.reimbursements SET approval_status = v_new_status, decided_at = now(), decided_by = auth.uid(), updated_at = now() WHERE id = p_reimbursement_id;
  INSERT INTO public.approval_history (reimbursement_id, actor_id, action, note, previous_status, new_status)
  VALUES (p_reimbursement_id, auth.uid(), v_action, p_note, 'pending', v_new_status);

  RETURN jsonb_build_object('success', true, 'status', v_new_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_payment(
  p_reimbursement_id UUID,
  p_amount NUMERIC(14,2),
  p_paid_at DATE,
  p_payment_method TEXT,
  p_reference_number TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_r RECORD;
  v_payment_id UUID;
BEGIN
  IF NOT public.is_boss() THEN RAISE EXCEPTION 'Hanya Bos yang berwenang'; END IF;
  SELECT * INTO v_r FROM public.reimbursements WHERE id = p_reimbursement_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Klaim tidak ditemukan'; END IF;
  IF v_r.approval_status <> 'approved' THEN RAISE EXCEPTION 'Klaim belum disetujui'; END IF;
  IF v_r.payment_status = 'paid' THEN RAISE EXCEPTION 'Klaim sudah dibayar'; END IF;
  IF p_amount <> v_r.amount THEN RAISE EXCEPTION 'Nominal bayar harus sesuai dengan nominal disetujui'; END IF;

  INSERT INTO public.payments (reimbursement_id, recorded_by, amount_paid, paid_at, payment_method, reference_number, notes)
  VALUES (p_reimbursement_id, auth.uid(), p_amount, p_paid_at, p_payment_method, p_reference_number, p_notes)
  RETURNING id INTO v_payment_id;

  UPDATE public.reimbursements SET payment_status = 'paid', updated_at = now() WHERE id = p_reimbursement_id;
  INSERT INTO public.approval_history (reimbursement_id, actor_id, action, note, previous_status, new_status)
  VALUES (p_reimbursement_id, auth.uid(), 'payment_recorded', format('Lunas via %s', p_payment_method), 'approved', 'approved');

  RETURN jsonb_build_object('success', true, 'payment_id', v_payment_id, 'payment_status', 'paid');
END;
$$;

-- 11. STORAGE BUCKET & AUTH TRIGGER
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('reimbursement-receipts', 'reimbursement-receipts', false, 10485760, ARRAY['image/jpeg', 'image/png', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Allow authenticated user to upload own receipts" ON storage.objects;
  DROP POLICY IF EXISTS "Allow owner or boss to select receipts" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Allow authenticated user to upload own receipts" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'reimbursement-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Allow owner or boss to select receipts" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'reimbursement-receipts' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_boss()));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, employee_code, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'employee'),
    NEW.raw_user_meta_data->>'employee_code',
    true
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 12. SEED INITIAL CATEGORIES
INSERT INTO public.categories (name, description, is_active)
VALUES 
  ('Transportasi', 'Biaya perjalanan dinas, bensin, tol, taksi/ojek online', true),
  ('Makan dan Minum', 'Konsumsi lembur, jamuan klien, atau konsumsi dinas luar', true),
  ('Akomodasi/Penginapan', 'Hotel atau penginapan perjalanan dinas', true),
  ('Pembelian Perlengkapan', 'Alat tulis kantor, perlengkapan kerja operasional kecil', true),
  ('Operasional Pekerjaan', 'Biaya internet, komunikasi dinas, pengiriman logistik/kurir', true),
  ('Lainnya', 'Biaya tak terduga lainnya yang terkait urusan kantor', true)
ON CONFLICT (LOWER(name)) DO NOTHING;
