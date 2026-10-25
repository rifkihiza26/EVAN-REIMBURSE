# Panduan Setup Proyek Employee Reimbursement

Aplikasi web internal perusahaan untuk pengajuan, pemeriksaan, persetujuan, dan pencatatan pembayaran reimbursement pegawai (Mobile-First).

---

## 1. Prasyarat Sistem
- **Node.js**: `v18.0.0` atau lebih baru (teruji pada Node `v24.x`).
- **NPM**: `v9.x` atau lebih baru.
- **Akun Supabase**: Proyek PostgreSQL Supabase aktif.

---

## 2. Setup Proyek Frontend Lokal

1. Salin template variabel lingkungan:
   ```bash
   cp .env.example .env
   ```

2. Buka `.env` dan masukkan konfigurasi Supabase Anda:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   VITE_COMPANY_NAME="PT Perusahaan Sejahtera"
   ```
   > **Catatan Keamanan Penting**: JANGAN PERNAH menaruh `SUPABASE_SERVICE_ROLE_KEY` pada file `.env` atau kode frontend browser!

3. Jalankan aplikasi pada lingkungan development:
   ```bash
   npm run dev
   ```

4. Verifikasi build produksi:
   ```bash
   npm run build
   ```

---

## 3. Setup Database Supabase & Migrasi

Jalankan script SQL berikut secara berurutan di menu **SQL Editor** pada dashboard Supabase Anda:

1. [`supabase/migrations/001_initial_schema.sql`](file:///Users/mac/EVAN-REIMBURSE/supabase/migrations/001_initial_schema.sql):
   - Tabel `profiles`, `categories`, `reimbursements`, `reimbursement_files`, `approval_history`, dan `payments`.
   - Index pencarian dan relasi foreign key restrict.
   - Generator nomor klaim unik atomik (`generate_claim_number`).
2. [`supabase/migrations/002_security_rls_and_rpc.sql`](file:///Users/mac/EVAN-REIMBURSE/supabase/migrations/002_security_rls_and_rpc.sql):
   - Row Level Security (RLS) diaktifkan untuk seluruh tabel privat.
   - Policy akses karyawan (hanya data sendiri) & Bos (seluruh data).
   - Fungsi transaksi atomik RPC: `submit_reimbursement`, `cancel_reimbursement`, `decide_reimbursement`, dan `record_payment`.
3. [`supabase/migrations/003_storage_and_auth_trigger.sql`](file:///Users/mac/EVAN-REIMBURSE/supabase/migrations/003_storage_and_auth_trigger.sql):
   - Pembuatan bucket storage privat `reimbursement-receipts` (10 MB per file, tipe JPEG/PNG/PDF).
   - Storage RLS Policy (karyawan hanya upload ke foldernya sendiri; berkas hanya dibaca pemilik atau Bos).
   - Trigger otomatis sinkronisasi `auth.users` ke `public.profiles`.
4. [`supabase/seed.sql`](file:///Users/mac/EVAN-REIMBURSE/supabase/seed.sql):
   - Kategori pengeluaran default: Transportasi, Makan dan Minum, Akomodasi/Penginapan, Pembelian Perlengkapan, Operasional Pekerjaan, Lainnya.

---

## 4. Prosedur Pembuatan Akun Bos Pertama (Aman)

Pendaftaran publik sengaja dinonaktifkan demi keamanan internal perusahaan. Ikuti langkah berikut untuk menginisialisasi akun Bos pertama:

1. Buka dashboard Supabase -> **Authentication** -> **Users** -> Klik **Add user** (Create user).
2. Masukkan email dan password untuk Bos, misalnya `boss@perusahaan.com`. Centang *Auto Confirm User*.
3. Buka **SQL Editor** di Supabase dan jalankan query berikut untuk menetapkan role `boss`:
   ```sql
   UPDATE public.profiles
   SET role = 'boss'
   WHERE email = 'boss@perusahaan.com';
   ```
4. Akun Bos sekarang dapat login di halaman `/login` dan memiliki hak akses penuh sebagai approver tunggal.

---

## 5. Ringkasan Fitur yang Diimplementasikan Sesuai PRD

- **Mobile-First UX**: Dirancang fleksibel untuk layar $\ge 360$ px dengan tombol touch target $\ge 44 \times 44$ px, form ramah kamera struk HP, kartu riwayat, dan bottom navigation di mobile. Tampilan desktop dilengkapi sidebar navigasi profesional.
- **Autentikasi & Otorisasi**: Proteksi route ketat berbasis role (`boss` dan `employee`).
- **Alur Karyawan**: Form pengajuan klaim dengan validasi nominal Rupiah, pilihan sumber dana (pribadi vs perusahaan), upload multi-file struk privat, simpan draf, pembatalan klaim draf/pending, dan perbaikan revisi resubmit.
- **Alur Bos**: Dashboard metrik pengawasan pengeluaran, antrean persetujuan dengan modal konfirmasi (Setujui, Tolak wajib alasan, Minta Revisi wajib catatan perbaikan), manajemen akun pegawai, dan kategori biaya.
- **Pencatatan Pembayaran**: Satu kali pembayaran penuh oleh Bos untuk klaim disetujui melalui fungsi atomik database `record_payment`.
- **Ekspor Laporan**: Ekspor Excel (`.xlsx`) rapi dan PDF (`.pdf`) multi-halaman dengan ringkasan, total terpisah (diajukan, disetujui, dibayar), dan nomor halaman.
