-- ==============================================================================
-- Migration: 002_security_rls_and_rpc.sql
-- Description: Row Level Security (RLS) policies and safe atomic RPC functions
-- ==============================================================================

-- 1. ENABLE RLS ON ALL PUBLIC TABLES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reimbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reimbursement_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 2. SECURITY HELPER FUNCTIONS (Bypass RLS recursion using SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

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

-- 3. RLS POLICIES FOR profiles
-- Everyone can read their own profile; Boss can read all active profiles.
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Boss can read all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_boss());

-- User can update limited personal info (e.g. full_name), but cannot change role, email or is_active
CREATE POLICY "Users can update own name"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    AND is_active = (SELECT is_active FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Boss can update employee profiles"
  ON public.profiles FOR UPDATE
  USING (public.is_boss());

-- 4. RLS POLICIES FOR categories
-- Any authenticated user can read active categories
CREATE POLICY "Authenticated users can view active categories"
  ON public.categories FOR SELECT
  TO authenticated
  USING (is_active = true OR public.is_boss());

-- Only Boss can insert/update categories
CREATE POLICY "Boss can manage categories"
  ON public.categories FOR ALL
  TO authenticated
  USING (public.is_boss())
  WITH CHECK (public.is_boss());

-- 5. RLS POLICIES FOR reimbursements
-- Employee can read own reimbursements; Boss can read all reimbursements
CREATE POLICY "Employees can view own reimbursements"
  ON public.reimbursements FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid() OR public.is_boss());

-- Employee can insert their own reimbursement (must be auth.uid(), initial status draft or pending, unpaid)
CREATE POLICY "Employees can insert own reimbursement"
  ON public.reimbursements FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_id = auth.uid()
    AND approval_status IN ('draft', 'pending')
    AND payment_status = 'unpaid'
  );

-- Employee can only update own reimbursement if status is draft or revision
CREATE POLICY "Employees can update own draft or revision reimbursement"
  ON public.reimbursements FOR UPDATE
  TO authenticated
  USING (
    employee_id = auth.uid()
    AND approval_status IN ('draft', 'revision')
  )
  WITH CHECK (
    employee_id = auth.uid()
    AND approval_status IN ('draft', 'pending', 'cancelled')
  );

-- Boss can update reimbursements (for approval decisions)
CREATE POLICY "Boss can update reimbursements"
  ON public.reimbursements FOR UPDATE
  TO authenticated
  USING (public.is_boss());

-- 6. RLS POLICIES FOR reimbursement_files
-- Can read file records if user owns the parent reimbursement or is boss
CREATE POLICY "Users can view files of authorized reimbursements"
  ON public.reimbursement_files FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reimbursements r
      WHERE r.id = reimbursement_files.reimbursement_id
      AND (r.employee_id = auth.uid() OR public.is_boss())
    )
  );

-- Employee can insert files for their own reimbursements
CREATE POLICY "Employees can insert files for own reimbursements"
  ON public.reimbursement_files FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.reimbursements r
      WHERE r.id = reimbursement_files.reimbursement_id
      AND r.employee_id = auth.uid()
      AND r.approval_status IN ('draft', 'pending', 'revision')
    )
  );

-- 7. RLS POLICIES FOR approval_history
-- Users can view history if they own the reimbursement or are Boss
CREATE POLICY "Users can view approval history of authorized reimbursements"
  ON public.approval_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reimbursements r
      WHERE r.id = approval_history.reimbursement_id
      AND (r.employee_id = auth.uid() OR public.is_boss())
    )
  );

-- Insert history: authenticated user can append events (normally handled via RPC or controlled insert)
CREATE POLICY "Users can append approval history"
  ON public.approval_history FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- 8. RLS POLICIES FOR payments
-- Boss can read all payments; Employee can read payment for their own reimbursement
CREATE POLICY "Users can view authorized payments"
  ON public.payments FOR SELECT
  TO authenticated
  USING (
    public.is_boss()
    OR EXISTS (
      SELECT 1 FROM public.reimbursements r
      WHERE r.id = payments.reimbursement_id
      AND r.employee_id = auth.uid()
    )
  );

-- Only Boss can insert payments
CREATE POLICY "Only Boss can record payments"
  ON public.payments FOR INSERT
  TO authenticated
  WITH CHECK (public.is_boss() AND recorded_by = auth.uid());

-- ==============================================================================
-- 9. ATOMIC RPC FUNCTIONS (SECURITY DEFINER)
-- ==============================================================================

-- A. Submit / Resubmit Reimbursement
CREATE OR REPLACE FUNCTION public.submit_reimbursement(
  p_reimbursement_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_r RECORD;
  v_action TEXT;
  v_prev_status TEXT;
  v_file_count INT;
BEGIN
  SELECT * INTO v_r FROM public.reimbursements WHERE id = p_reimbursement_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Klaim tidak ditemukan';
  END IF;

  IF v_r.employee_id <> auth.uid() THEN
    RAISE EXCEPTION 'Akses ditolak: Anda hanya dapat mengirim klaim milik Anda sendiri';
  END IF;

  IF v_r.approval_status NOT IN ('draft', 'revision') THEN
    RAISE EXCEPTION 'Hanya klaim berstatus draft atau revision yang dapat dikirim';
  END IF;

  -- Cek minimal 1 file bukti wajib (PRD 5.4 & 14)
  SELECT COUNT(*) INTO v_file_count FROM public.reimbursement_files WHERE reimbursement_id = p_reimbursement_id;
  IF v_file_count = 0 THEN
    RAISE EXCEPTION 'Klaim wajib memiliki minimal 1 berkas bukti transaksi sebelum dikirim';
  END IF;

  v_prev_status := v_r.approval_status;
  IF v_r.approval_status = 'draft' THEN
    v_action := 'submitted';
  ELSE
    v_action := 'resubmitted';
  END IF;

  UPDATE public.reimbursements
  SET
    approval_status = 'pending',
    submitted_at = now(),
    updated_at = now()
  WHERE id = p_reimbursement_id;

  INSERT INTO public.approval_history (
    reimbursement_id,
    actor_id,
    action,
    note,
    previous_status,
    new_status
  ) VALUES (
    p_reimbursement_id,
    auth.uid(),
    v_action,
    p_note,
    v_prev_status,
    'pending'
  );

  RETURN jsonb_build_object('success', true, 'status', 'pending');
END;
$$;

-- B. Cancel Reimbursement (by Employee)
CREATE OR REPLACE FUNCTION public.cancel_reimbursement(
  p_reimbursement_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_r RECORD;
BEGIN
  SELECT * INTO v_r FROM public.reimbursements WHERE id = p_reimbursement_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Klaim tidak ditemukan';
  END IF;

  IF v_r.employee_id <> auth.uid() THEN
    RAISE EXCEPTION 'Akses ditolak: Anda hanya dapat membatalkan klaim Anda sendiri';
  END IF;

  IF v_r.approval_status NOT IN ('draft', 'pending') THEN
    RAISE EXCEPTION 'Hanya klaim draft atau pending yang dapat dibatalkan';
  END IF;

  UPDATE public.reimbursements
  SET
    approval_status = 'cancelled',
    updated_at = now()
  WHERE id = p_reimbursement_id;

  INSERT INTO public.approval_history (
    reimbursement_id,
    actor_id,
    action,
    note,
    previous_status,
    new_status
  ) VALUES (
    p_reimbursement_id,
    auth.uid(),
    'cancelled',
    p_reason,
    v_r.approval_status,
    'cancelled'
  );

  RETURN jsonb_build_object('success', true, 'status', 'cancelled');
END;
$$;

-- C. Decide Reimbursement (Approve, Reject, Request Revision by Boss)
CREATE OR REPLACE FUNCTION public.decide_reimbursement(
  p_reimbursement_id UUID,
  p_decision TEXT, -- 'approved', 'rejected', 'revision_requested'
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_r RECORD;
  v_new_status TEXT;
  v_action TEXT;
BEGIN
  IF NOT public.is_boss() THEN
    RAISE EXCEPTION 'Hanya akun Bos yang memiliki wewenang untuk memutuskan klaim';
  END IF;

  SELECT * INTO v_r FROM public.reimbursements WHERE id = p_reimbursement_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Klaim tidak ditemukan';
  END IF;

  IF v_r.approval_status <> 'pending' THEN
    RAISE EXCEPTION 'Hanya klaim yang berstatus pending yang dapat diputuskan';
  END IF;

  IF p_decision = 'approved' THEN
    v_new_status := 'approved';
    v_action := 'approved';
  ELSIF p_decision = 'rejected' THEN
    IF p_note IS NULL OR trim(p_note) = '' THEN
      RAISE EXCEPTION 'Alasan wajib diisi ketika menolak klaim';
    END IF;
    v_new_status := 'rejected';
    v_action := 'rejected';
  ELSIF p_decision = 'revision_requested' THEN
    IF p_note IS NULL OR trim(p_note) = '' THEN
      RAISE EXCEPTION 'Catatan perbaikan wajib diisi ketika meminta revisi klaim';
    END IF;
    v_new_status := 'revision';
    v_action := 'revision_requested';
  ELSE
    RAISE EXCEPTION 'Keputusan tidak valid. Pilihan: approved, rejected, revision_requested';
  END IF;

  UPDATE public.reimbursements
  SET
    approval_status = v_new_status,
    decided_at = now(),
    decided_by = auth.uid(),
    updated_at = now()
  WHERE id = p_reimbursement_id;

  INSERT INTO public.approval_history (
    reimbursement_id,
    actor_id,
    action,
    note,
    previous_status,
    new_status
  ) VALUES (
    p_reimbursement_id,
    auth.uid(),
    v_action,
    p_note,
    'pending',
    v_new_status
  );

  RETURN jsonb_build_object('success', true, 'status', v_new_status);
END;
$$;

-- D. Atomic Record Payment (by Boss)
CREATE OR REPLACE FUNCTION public.record_payment(
  p_reimbursement_id UUID,
  p_amount NUMERIC(14,2),
  p_paid_at DATE,
  p_payment_method TEXT,
  p_reference_number TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_r RECORD;
  v_payment_id UUID;
BEGIN
  IF NOT public.is_boss() THEN
    RAISE EXCEPTION 'Hanya akun Bos yang berwenang mencatat pembayaran';
  END IF;

  SELECT * INTO v_r FROM public.reimbursements WHERE id = p_reimbursement_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Klaim tidak ditemukan';
  END IF;

  IF v_r.approval_status <> 'approved' THEN
    RAISE EXCEPTION 'Hanya klaim yang telah disetujui (approved) yang dapat dibayar';
  END IF;

  IF v_r.payment_status = 'paid' THEN
    RAISE EXCEPTION 'Klaim ini sudah dibayar sebelumnya dan tidak dapat dibayar ulang';
  END IF;

  -- Verifikasi nominal pembayaran sesuai nominal approved (pembayaran penuh satu kali, PRD 5.4 & 8.6)
  IF p_amount <> v_r.amount THEN
    RAISE EXCEPTION 'Nominal pembayaran (%) harus sama persis dengan nominal klaim disetujui (%)', p_amount, v_r.amount;
  END IF;

  IF p_payment_method NOT IN ('cash', 'bank_transfer') THEN
    RAISE EXCEPTION 'Metode pembayaran harus cash atau bank_transfer';
  END IF;

  -- Buat record pembayaran
  INSERT INTO public.payments (
    reimbursement_id,
    recorded_by,
    amount_paid,
    paid_at,
    payment_method,
    reference_number,
    notes
  ) VALUES (
    p_reimbursement_id,
    auth.uid(),
    p_amount,
    p_paid_at,
    p_payment_method,
    p_reference_number,
    p_notes
  ) RETURNING id INTO v_payment_id;

  -- Update reimbursement payment_status
  UPDATE public.reimbursements
  SET
    payment_status = 'paid',
    updated_at = now()
  WHERE id = p_reimbursement_id;

  -- Append audit history
  INSERT INTO public.approval_history (
    reimbursement_id,
    actor_id,
    action,
    note,
    previous_status,
    new_status
  ) VALUES (
    p_reimbursement_id,
    auth.uid(),
    'payment_recorded',
    format('Pembayaran dicatat via %s. Ref: %s', p_payment_method, coalesce(p_reference_number, '-')),
    'approved',
    'approved'
  );

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'payment_status', 'paid'
  );
END;
$$;
