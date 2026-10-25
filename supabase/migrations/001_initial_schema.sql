-- ==============================================================================
-- Migration: 001_initial_schema.sql
-- Description: Core schema for Employee Reimbursement System
-- Tables: profiles, categories, reimbursements, reimbursement_files, approval_history, payments
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUMS & DOMAINS (OR CHECK CONSTRAINTS)
-- Sesuai PRD bagian 8:
-- profiles: role IN ('boss', 'employee')
-- reimbursements: approval_status IN ('draft', 'pending', 'revision', 'approved', 'rejected', 'cancelled')
-- reimbursements: payment_status IN ('unpaid', 'paid')
-- reimbursements: payment_source IN ('personal', 'company')
-- reimbursement_files: file_size > 0
-- approval_history: action IN ('created', 'submitted', 'resubmitted', 'revision_requested', 'approved', 'rejected', 'cancelled', 'payment_recorded')
-- payments: payment_method IN ('cash', 'bank_transfer')

-- 3. PROFILES TABLE
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

-- 4. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name ON public.categories(LOWER(name));

-- 5. REIMBURSEMENTS TABLE & SEQUENCE FOR CLAIM NUMBER
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

-- 6. REIMBURSEMENT FILES TABLE
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

-- 7. APPROVAL HISTORY TABLE (Append-Only)
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

-- 8. PAYMENTS TABLE
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

-- 9. HELPER FUNCTIONS & TRIGGERS

-- Function to generate safe human-readable claim numbers: RMB-YYYYMM-XXXX
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

-- Trigger to auto-update updated_at columns
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
