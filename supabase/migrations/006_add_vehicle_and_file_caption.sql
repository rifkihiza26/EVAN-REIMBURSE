-- ==============================================================================
-- Migration: 006_add_vehicle_and_file_caption.sql
-- Description:
-- 1. Menambahkan kolom vehicle_info pada tabel reimbursements (informasi kendaraan yang digunakan, misal: Mobil Pribadi B 1234 CD, Motor Kantor, dsb.)
-- 2. Menambahkan kolom caption pada tabel reimbursement_files (keterangan foto struk/nota)
-- ==============================================================================

-- 1. Kolom vehicle_info di tabel reimbursements
ALTER TABLE public.reimbursements
ADD COLUMN IF NOT EXISTS vehicle_info TEXT NULL;

-- 2. Kolom caption di tabel reimbursement_files
ALTER TABLE public.reimbursement_files
ADD COLUMN IF NOT EXISTS caption TEXT NULL;
