-- ==============================================================================
-- Seed Data: Initial Categories & Setup Instructions
-- ==============================================================================

-- Kategori Awal Sesuai PRD Bagian 6 (FR-11)
INSERT INTO public.categories (name, description, is_active)
VALUES 
  ('Transportasi', 'Biaya perjalanan dinas, bensin, tol, taksi/ojek online', true),
  ('Makan dan Minum', 'Konsumsi lembur, jamuan klien, atau konsumsi dinas luar', true),
  ('Akomodasi/Penginapan', 'Hotel atau penginapan perjalanan dinas', true),
  ('Pembelian Perlengkapan', 'Alat tulis kantor, perlengkapan kerja operasional kecil', true),
  ('Operasional Pekerjaan', 'Biaya internet, komunikasi dinas, pengiriman logistik/kurir', true),
  ('Lainnya', 'Biaya tak terduga lainnya yang terkait urusan kantor', true)
ON CONFLICT (LOWER(name)) DO NOTHING;

-- Catatan Pembuatan Akun Bos Pertama (PRD 4.3):
-- 1. Buat user di Supabase Dashboard -> Authentication -> Users (misal: boss@perusahaan.com).
-- 2. Jalankan query berikut untuk menetapkan role 'boss':
--    UPDATE public.profiles SET role = 'boss' WHERE email = 'boss@perusahaan.com';
