# Product Requirements Document (PRD)

## Website Reimbursement Pegawai --- Mobile-First

**Versi:** 1.0\
**Status:** Baseline untuk implementasi\
**Tanggal:** 25 Oktober 2026\
**Nama proyek sementara:** Employee Reimbursement\
**Dokumen acuan utama:** `PRD.md`

------------------------------------------------------------------------

## 1. Ringkasan Produk

Employee Reimbursement adalah aplikasi web internal perusahaan untuk
mengajukan, memeriksa, menyetujui, menolak, merevisi, dan mencatat
pembayaran penggantian biaya pegawai. Karyawan mengisi formulir dan
melampirkan bukti transaksi. Satu akun Bos bertindak sebagai approver
tunggal dan mencatat pembayaran setelah uang benar-benar dibayarkan di
luar aplikasi.

Aplikasi ditujukan untuk sekitar 10--50 karyawan. Produk harus
**mobile-first**: pengalaman utama dirancang untuk layar ponsel,
sentuhan, formulir singkat, dan navigasi sederhana. Aplikasi tetap harus
responsif dan nyaman digunakan pada tablet dan desktop.

Aplikasi tidak memproses transfer uang secara otomatis. Status
pembayaran hanya berubah menjadi sudah dibayar setelah Bos benar-benar
melakukan pembayaran dan mencatatnya di aplikasi.

## 2. Tujuan Produk

1.  Menggantikan proses klaim manual melalui chat, kertas, atau catatan
    pribadi.
2.  Memudahkan karyawan mengirim klaim beserta bukti transaksi dari
    ponsel.
3.  Memberikan Bos satu tempat untuk memeriksa dan memutuskan semua
    klaim.
4.  Memisahkan status persetujuan dari status pembayaran.
5.  Menyediakan riwayat yang dapat diaudit untuk pengajuan dan
    keputusan.
6.  Menyediakan laporan dengan filter dan ekspor PDF serta Excel.
7.  Menjaga data klaim dan bukti transaksi hanya dapat diakses oleh
    pengguna berwenang.

## 3. Tujuan dan Non-Tujuan

### 3.1 Termasuk dalam cakupan (In Scope)

-   Login, logout, dan pemulihan kata sandi.
-   Dua role: `boss` dan `employee`.
-   Pembuatan dan penonaktifan akun karyawan oleh Bos.
-   Dashboard berbeda sesuai role.
-   Form pengajuan reimbursement dan upload beberapa bukti.
-   Riwayat dan detail pengajuan.
-   Keputusan Bos: setujui, tolak, atau minta revisi.
-   Revisi pengajuan dan pengiriman ulang dengan riwayat.
-   Pencatatan pembayaran manual oleh Bos.
-   Filter, pencarian, laporan, ekspor PDF, dan ekspor Excel.
-   Notifikasi status di dalam aplikasi.
-   RLS, private storage, validasi server/database, dan audit trail.
-   Tampilan mobile-first yang responsif untuk tablet dan desktop.

### 3.2 Tidak termasuk dalam versi awal (Out of Scope)

-   Transfer bank atau pembayaran otomatis dari aplikasi.
-   Approval bertingkat atau banyak approver.
-   Pembayaran sebagian/cicilan.
-   Pengelolaan payroll, akuntansi penuh, pajak, atau integrasi ERP.
-   Aplikasi native Android/iOS.
-   Notifikasi WhatsApp/SMS/push eksternal.
-   OCR otomatis untuk membaca struk.
-   Pengajuan atas nama pegawai lain.
-   Multi-perusahaan atau multi-cabang.
-   Alur reimbursement dengan banyak mata uang.
-   Tanda tangan digital.
-   Penghapusan permanen riwayat klaim dari UI.

## 4. Pengguna dan Role

### 4.1 Karyawan (`employee`)

Karyawan dapat: - Login dan logout. - Melihat dashboard serta statistik
klaim miliknya. - Membuat klaim. - Mengunggah bukti transaksi. -
Menyimpan draft jika fitur draft diimplementasikan. - Mengirim klaim
untuk persetujuan. - Melihat detail, status, catatan Bos, dan riwayat
klaim sendiri. - Mengedit dan mengirim ulang klaim berstatus
`revision`. - Membatalkan klaim yang masih `draft` atau `pending`,
sesuai aturan yang ditetapkan. - Melihat status pembayaran setelah klaim
disetujui. - Mengubah informasi profil yang diizinkan.

Karyawan tidak dapat: - Membaca klaim karyawan lain. - Menyetujui atau
menolak klaim. - Mengubah role sendiri. - Mengubah status
persetujuan/pembayaran secara langsung. - Mencatat pembayaran. -
Mengekspor laporan seluruh perusahaan.

### 4.2 Bos (`boss`)

Bos dapat: - Melihat ringkasan dan semua klaim. - Memeriksa detail serta
bukti transaksi. - Menyetujui, menolak, atau meminta revisi. - Wajib
memberikan alasan ketika menolak atau meminta revisi. - Melihat riwayat
keputusan dan perubahan status. - Mencatat pembayaran klaim yang
disetujui dan belum dibayar. - Melihat riwayat pembayaran. - Memfilter
dan mencari klaim. - Mengekspor laporan PDF dan Excel. -
Membuat/mengundang akun karyawan dan menonaktifkan akun. - Mengelola
kategori pengeluaran, jika modul kategori diaktifkan.

Bos tidak dapat: - Mencatat pembayaran untuk klaim yang belum
disetujui. - Menandai klaim sudah dibayar tanpa memasukkan data
pembayaran yang valid. - Mengubah atau menghapus jejak audit melalui
antarmuka normal. - Membuat akun Bos kedua melalui alur pendaftaran
publik.

### 4.3 Pembuatan akun Bos awal

Pendaftaran publik dinonaktifkan. Akun Bos pertama dibuat melalui
prosedur setup aman yang didokumentasikan, misalnya membuat pengguna
melalui Supabase Auth lalu menetapkan role melalui SQL/migrasi atau
skrip administratif yang tidak terekspos ke browser. Jangan menanamkan
service-role key di frontend.

## 5. Status dan Alur Bisnis

### 5.1 Status persetujuan

Nilai database: - `draft` --- masih disusun dan belum dikirim. -
`pending` --- dikirim dan menunggu keputusan Bos. - `revision` ---
dikembalikan untuk diperbaiki. - `approved` --- disetujui. - `rejected`
--- ditolak. - `cancelled` --- dibatalkan sesuai aturan.

Label UI menggunakan Bahasa Indonesia: Draft, Menunggu Persetujuan,
Perlu Revisi, Disetujui, Ditolak, Dibatalkan.

### 5.2 Status pembayaran

Nilai database: - `unpaid` --- belum dibayar. - `paid` --- pembayaran
telah dilakukan dan dicatat oleh Bos.

Status pembayaran terpisah dari status persetujuan. Status pembayaran
hanya berlaku secara operasional untuk klaim `approved`. Klaim
`rejected`, `revision`, `draft`, atau `cancelled` tidak boleh memiliki
pembayaran yang sah.

### 5.3 Alur utama

1.  Karyawan login.
2.  Karyawan membuat klaim dengan tanggal pengeluaran, kategori,
    nominal, sumber dana, keterangan, dan bukti.
3.  Karyawan mengirim klaim.
4.  Sistem memvalidasi data, menyimpan klaim, dan mencatat tindakan
    `submitted`.
5.  Klaim tampil pada antrean Bos dengan status `pending`.
6.  Bos memeriksa informasi dan bukti.
7.  Bos memilih:
    -   **Setujui:** status menjadi `approved`, pembayaran tetap
        `unpaid`.
    -   **Tolak:** status menjadi `rejected`; alasan wajib dicatat.
    -   **Minta revisi:** status menjadi `revision`; catatan perbaikan
        wajib dicatat.
8.  Jika direvisi, karyawan mengubah data yang diizinkan dan mengirim
    ulang. Riwayat sebelumnya tidak dihapus; status kembali `pending`.
9.  Setelah pembayaran dilakukan di luar aplikasi, Bos membuka klaim
    `approved` yang belum dibayar, memasukkan nominal, tanggal, metode
    pembayaran, dan referensi opsional.
10. Sistem memvalidasi pembayaran, menyimpan catatan pembayaran,
    mengubah status menjadi `paid`, dan menambahkan audit event.
11. Karyawan dapat melihat status pembayaran dan detail terkait.
12. Bos memfilter laporan dan mengekspor PDF atau Excel.

### 5.4 Aturan bisnis penting

-   Nominal klaim harus lebih besar dari nol.
-   Karyawan hanya boleh membuat klaim untuk dirinya sendiri.
-   Minimal satu bukti transaksi wajib untuk pengajuan yang dikirim.
-   Tipe file yang diizinkan: JPEG, PNG, dan PDF; batas ukuran awal yang
    disarankan 10 MB per file. Nilai ini harus dapat diubah melalui
    konfigurasi.
-   Sistem dapat memperingatkan kemungkinan klaim duplikat berdasarkan
    tanggal, nominal, kategori, dan kemiripan data/bukti; jangan
    otomatis menolak hanya karena tanggal dan nominal sama.
-   Sumber dana `personal` berarti karyawan telah membayar dengan uang
    pribadi dan meminta penggantian.
-   Sumber dana `company` berarti transaksi telah dibayar menggunakan
    dana perusahaan; secara default tidak eligible untuk penggantian
    uang kepada karyawan. Jika pengguna memilih `company`, UI harus
    menjelaskan bahwa klaim tersebut tidak diproses sebagai
    reimbursement tunai. Bos dapat memutuskan penanganan yang sesuai
    kebijakan perusahaan, tetapi aplikasi tidak boleh otomatis mencatat
    pembayaran kepada karyawan.
-   Setelah disetujui, nominal dan data penting tidak dapat diedit
    langsung. Jika koreksi diperlukan, harus ada alur pembatalan/riwayat
    yang jelas; jangan mengubah klaim diam-diam.
-   Klaim yang sudah dibayar tidak dapat diedit, dibatalkan, atau
    dibayar ulang melalui alur normal.
-   Penolakan dan permintaan revisi harus menyertakan catatan.
-   Pembayaran versi awal bersifat penuh satu kali, tidak mendukung
    pembayaran sebagian.
-   Waktu disimpan sebagai timestamp dengan zona waktu yang konsisten
    (UTC di database dianjurkan); UI menampilkan zona waktu lokal yang
    ditentukan proyek.
-   Jangan menghapus profil karyawan secara cascading jika klaim
    historis masih terkait. Nonaktifkan akun dan pertahankan riwayat.

## 6. Persyaratan Fungsional

### FR-01 Autentikasi

-   Login email dan kata sandi.
-   Logout.
-   Pemulihan kata sandi.
-   Proteksi route berdasarkan sesi dan role.
-   Redirect ke dashboard yang sesuai role.
-   Pendaftaran publik dinonaktifkan.

### FR-02 Dashboard Karyawan

-   Menampilkan jumlah klaim menurut status.
-   Menampilkan total nominal klaim pribadi dengan definisi yang jelas.
-   Menampilkan beberapa klaim terbaru.
-   Tombol utama "Ajukan Reimbursement".
-   Empty state yang menjelaskan langkah selanjutnya.

### FR-03 Form Pengajuan

Field minimum: - Tanggal pengeluaran. - Kategori. - Nominal Rupiah. -
Sumber dana: uang pribadi atau dana perusahaan. - Keterangan. - Satu
atau lebih bukti transaksi. - Tombol Simpan Draft (jika draft didukung)
dan Kirim Pengajuan.

Validasi: - Tanggal valid dan tidak kosong. - Kategori aktif. - Nominal
numerik positif. - Keterangan memiliki batas panjang yang wajar. -
Minimal satu bukti saat pengajuan dikirim. - File hanya tipe yang
diizinkan dan ukuran di bawah batas. - Identitas pengaju berasal dari
sesi terautentikasi, bukan input bebas.

### FR-04 Riwayat dan Detail Karyawan

-   Menampilkan hanya klaim pengguna yang login.
-   Filter status dan rentang tanggal.
-   Pencarian nomor klaim/keterangan.
-   Detail berisi data klaim, bukti, status, catatan Bos, riwayat, dan
    status pembayaran.
-   Edit/resubmit hanya ketika status mengizinkan.
-   Pembatalan mengikuti aturan status.
-   Status kosong, loading, dan error ditangani dengan baik.

### FR-05 Antrean Persetujuan Bos

-   Daftar klaim `pending`.
-   Sortir terbaru terlebih dahulu secara default.
-   Filter tanggal, nama karyawan, kategori, dan nominal/status.
-   Detail klaim dan preview/download bukti yang aman.
-   Tombol Setujui, Tolak, dan Minta Revisi.
-   Konfirmasi sebelum keputusan final.
-   Catatan wajib untuk penolakan/revisi.
-   Hindari keputusan ganda atau race condition jika dua tab terbuka.

### FR-06 Semua Pengajuan

-   Bos dapat melihat semua klaim.
-   Filter status persetujuan, status pembayaran, karyawan, kategori,
    dan periode.
-   Pencarian nomor klaim/keterangan.
-   Detail menunjukkan timeline/audit yang relevan.
-   Data diambil dengan pagination; jangan memuat semua baris tanpa
    batas.

### FR-07 Pembayaran

-   Daftar klaim disetujui dan belum dibayar.
-   Bos mencatat nominal, tanggal pembayaran, metode
    (`cash`/`bank_transfer`), nomor referensi opsional, dan catatan
    opsional.
-   Default nominal pembayaran harus sama dengan nominal yang disetujui.
-   Validasi dilakukan di server/database, bukan hanya frontend.
-   Satu pembayaran penuh per klaim pada versi awal.
-   Setelah berhasil, status pembayaran menjadi `paid`.
-   Simpan identitas pencatat dan waktu pencatatan.
-   Jangan mengizinkan pembayaran untuk klaim yang tidak `approved` atau
    sudah `paid`.

### FR-08 Dashboard Bos

Kartu statistik minimum: - Menunggu persetujuan. - Perlu revisi. -
Disetujui dan belum dibayar. - Total disetujui dalam periode. - Total
dibayar dalam periode. - Ditolak. Tampilkan grafik sederhana pengeluaran
per bulan atau kategori jika data memadai. Semua angka harus berasal
dari query yang benar dan memiliki label periode.

### FR-09 Laporan dan Ekspor

-   Halaman Laporan hanya untuk Bos.
-   Filter: tanggal pengeluaran/periode, status persetujuan, status
    pembayaran, karyawan, dan kategori.
-   Pilihan jenis periode: bulanan, rentang tanggal, atau semua periode.
-   Ekspor Excel `.xlsx` menggunakan data lengkap yang sesuai filter,
    bukan hanya baris yang terlihat di halaman.
-   Ekspor PDF `.pdf` dengan judul, identitas perusahaan yang
    dikonfigurasi, periode, waktu dibuat, ringkasan, tabel, total, dan
    nomor halaman.
-   Format Rupiah Indonesia dan tanggal konsisten.
-   Tabel PDF mendukung banyak halaman, header berulang, dan pemotongan
    teks yang wajar.
-   Jika data kosong, tampilkan pesan dan jangan membuat laporan yang
    menyesatkan.
-   Nama file memuat jenis laporan dan periode, misalnya
    `reimbursement-2026-10.xlsx` dan `reimbursement-2026-10.pdf`.
-   Ekspor harus mengikuti filter aktif dan menghormati RLS/hak akses.
-   Laporan ringkasan tidak menyertakan gambar struk secara otomatis.
    Lampiran bukti tetap dapat dibuka dari detail klaim.
-   Gunakan library yang sesuai, misalnya `xlsx` (SheetJS) untuk Excel
    dan `jspdf` + `jspdf-autotable` untuk PDF. Periksa lisensi, versi,
    dan kebutuhan bundling sebelum memilih versi paket.

### FR-10 Manajemen Karyawan

-   Hanya Bos dapat membuat/mengundang akun karyawan dan menonaktifkan
    akun.
-   Bos dapat melihat nama, email, kode karyawan, role, status aktif,
    dan tanggal dibuat.
-   Jangan menyediakan pengubahan role melalui form profil biasa.
-   Gunakan alur backend yang aman untuk administrasi akun; jangan
    expose Supabase service-role key pada browser.

### FR-11 Kategori

-   Kategori awal: Transportasi, Makan dan Minum, Akomodasi/Penginapan,
    Pembelian Perlengkapan, Operasional Pekerjaan, Lainnya.
-   Bos dapat mengaktifkan/menonaktifkan kategori jika modul ini
    diimplementasikan.
-   Kategori yang sudah digunakan tidak dihapus permanen.

### FR-12 Notifikasi dalam aplikasi

-   Tampilkan indikator atau pesan ketika klaim diajukan, direvisi,
    disetujui, ditolak, atau dibayar.
-   Notifikasi email/push/WhatsApp bukan bagian versi awal kecuali
    ditambahkan kemudian.

### FR-13 Audit Trail

-   Catat submit, resubmit, approval, rejection, revision request,
    cancellation, dan payment recording.
-   Catat actor, action, waktu, catatan, dan status yang relevan.
-   Pengguna biasa tidak boleh mengubah/menghapus audit event melalui
    UI.

## 7. Persyaratan UI/UX --- Mobile-First

### 7.1 Prinsip desain

-   Rancang dari viewport ponsel sekitar 360--390 px, lalu tingkatkan
    untuk tablet dan desktop.
-   Gunakan layout responsif, bukan tampilan desktop yang diperkecil.
-   Utamakan satu kolom pada ponsel; dua kolom hanya jika ruang memadai.
-   Gunakan tombol dengan area sentuh nyaman (sekitar 44×44 px atau
    lebih).
-   Teks utama terbaca, kontras memadai, fokus keyboard jelas, dan label
    form selalu terlihat.
-   Jangan mengandalkan warna saja untuk menunjukkan status; sertakan
    teks/ikon.
-   Sediakan loading, empty, success, validation, dan error state.
-   Hindari horizontal scrolling pada halaman normal. Untuk tabel lebar,
    gunakan tampilan kartu pada ponsel atau tabel responsif dengan kolom
    prioritas.
-   Sediakan konfirmasi untuk tindakan penting.
-   Tampilkan nominal dalam format Rupiah Indonesia, misalnya
    `Rp150.000`.
-   Tampilkan tanggal dalam format lokal yang konsisten, misalnya
    `25 Okt 2026`.
-   Optimalkan upload foto dari kamera/galeri ponsel.
-   Jangan membuat tombol dekoratif yang tidak berfungsi.

### 7.2 Navigasi

-   Mobile: gunakan bottom navigation atau menu ringkas yang konsisten;
    prioritaskan Dashboard, Pengajuan/Riwayat, dan Profil untuk
    karyawan. Untuk Bos, prioritaskan Dashboard, Persetujuan,
    Pembayaran, dan Laporan; item tambahan tersedia melalui menu
    "Lainnya".
-   Desktop: gunakan sidebar yang dapat diperkecil, area konten utama,
    dan header yang menampilkan pengguna/role.
-   Navigasi dan route harus konsisten antar ukuran layar.

### 7.3 Halaman dan route yang disarankan

Umum: - `/login` - `/forgot-password` - `/reset-password`

Karyawan: - `/employee/dashboard` - `/employee/reimbursements` -
`/employee/reimbursements/new` - `/employee/reimbursements/:id` -
`/employee/profile`

Bos: - `/boss/dashboard` - `/boss/approvals` - `/boss/reimbursements` -
`/boss/reimbursements/:id` - `/boss/payments` - `/boss/reports` -
`/boss/employees` - `/boss/categories` (jika modul kategori
diaktifkan) - `/boss/profile`

Route hanyalah usulan. Pilih satu pola dan konsisten. Route terlindungi
harus memvalidasi sesi dan role; proteksi frontend bukan pengganti RLS.

## 8. Model Data dan Database

Gunakan PostgreSQL melalui Supabase. Buat migration SQL yang
version-controlled. Jangan hanya mengandalkan pembuatan tabel manual di
dashboard.

### 8.1 `profiles`

-   `id uuid primary key references auth.users(id) on delete restrict`
-   `full_name text not null`
-   `email text not null`
-   `role text not null check (role in ('boss','employee'))`
-   `employee_code text null`
-   `is_active boolean not null default true`
-   `created_at timestamptz not null default now()`
-   `updated_at timestamptz not null default now()`

Pertimbangkan unique index untuk email yang dinormalisasi dan
`employee_code` jika nilainya diberikan. Jangan izinkan user mengubah
`role` atau `is_active` sendiri.

### 8.2 `categories`

-   `id uuid primary key default gen_random_uuid()`
-   `name text not null`
-   `description text null`
-   `is_active boolean not null default true`
-   `created_at timestamptz not null default now()`
-   `updated_at timestamptz not null default now()`

Buat aturan unik yang sesuai untuk nama kategori aktif jika diperlukan.

### 8.3 `reimbursements`

-   `id uuid primary key default gen_random_uuid()`
-   `claim_number text not null unique`
-   `employee_id uuid not null references profiles(id) on delete restrict`
-   `category_id uuid not null references categories(id) on delete restrict`
-   `expense_date date not null`
-   `amount numeric(14,2) not null check (amount > 0)`
-   `payment_source text not null check (payment_source in ('personal','company'))`
-   `description text not null`
-   `approval_status text not null default 'pending' check (approval_status in ('draft','pending','revision','approved','rejected','cancelled'))`
-   `payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid'))`
-   `submitted_at timestamptz null`
-   `decided_at timestamptz null`
-   `decided_by uuid null references profiles(id) on delete restrict`
-   `created_at timestamptz not null default now()`
-   `updated_at timestamptz not null default now()`

Tambahkan index untuk `employee_id`, `approval_status`,
`payment_status`, `expense_date`, `category_id`, `claim_number`, serta
kombinasi yang relevan untuk query laporan. `claim_number` dapat dibuat
dari sequence/ID melalui fungsi yang aman. Hindari pembuatan nomor klaim
yang hanya berdasarkan timestamp browser.

### 8.4 `reimbursement_files`

-   `id uuid primary key default gen_random_uuid()`
-   `reimbursement_id uuid not null references reimbursements(id) on delete restrict`
-   `storage_path text not null unique`
-   `original_filename text not null`
-   `mime_type text not null`
-   `file_size bigint not null check (file_size > 0)`
-   `uploaded_by uuid not null references profiles(id) on delete restrict`
-   `uploaded_at timestamptz not null default now()`

File disimpan di bucket private Supabase Storage. Jangan simpan public
URL permanen. Gunakan signed URL berumur pendek setelah pemeriksaan
akses. Validasi jenis file, ukuran, dan kepemilikan file.

### 8.5 `approval_history`

-   `id uuid primary key default gen_random_uuid()`
-   `reimbursement_id uuid not null references reimbursements(id) on delete restrict`
-   `actor_id uuid not null references profiles(id) on delete restrict`
-   `action text not null check (action in ('created','submitted','resubmitted','revision_requested','approved','rejected','cancelled','payment_recorded'))`
-   `note text null`
-   `previous_status text null`
-   `new_status text null`
-   `created_at timestamptz not null default now()`

Tabel ini append-only untuk pengguna aplikasi. Perubahan status dan
pencatatan riwayat idealnya terjadi dalam satu transaksi database.

### 8.6 `payments`

-   `id uuid primary key default gen_random_uuid()`
-   `reimbursement_id uuid not null unique references reimbursements(id) on delete restrict`
-   `recorded_by uuid not null references profiles(id) on delete restrict`
-   `amount_paid numeric(14,2) not null check (amount_paid > 0)`
-   `paid_at date not null`
-   `payment_method text not null check (payment_method in ('cash','bank_transfer'))`
-   `reference_number text null`
-   `notes text null`
-   `created_at timestamptz not null default now()`

Versi pertama hanya mendukung pembayaran penuh satu kali. Fungsi
database/backend harus memeriksa bahwa klaim telah disetujui, belum
dibayar, sumber dana memenuhi kebijakan reimbursement, dan nominal
pembayaran sesuai dengan nominal yang disetujui. Kemudian buat payment
row, ubah `payment_status` menjadi `paid`, dan catat audit event secara
atomik.

### 8.7 Catatan desain data

-   Jika diperlukan, tambahkan tabel `notifications` untuk notifikasi
    dalam aplikasi. Jangan mengimplementasikannya jika belum digunakan;
    alternatif awal adalah indikator status dari data klaim.
-   Simpan riwayat revisi penting. Jika revisi dapat mengubah nominal,
    pertimbangkan tabel snapshot/versi klaim atau simpan perubahan nilai
    penting dalam audit. Jangan menghapus data sebelumnya.
-   Hindari cascade delete pada klaim, pembayaran, dan audit.
-   Pastikan semua fungsi SQL memiliki `search_path` yang aman dan izin
    `EXECUTE` dibatasi dengan tepat.

## 9. Keamanan dan RLS

Keamanan adalah persyaratan wajib, bukan pekerjaan opsional.

-   Aktifkan RLS pada semua tabel yang terekspos melalui Supabase API.
-   Buat helper/fungsi untuk mengecek role jika diperlukan, dengan
    desain yang tidak menyebabkan rekursi RLS.
-   Karyawan hanya dapat `SELECT` klaim miliknya sendiri.
-   Karyawan hanya dapat `INSERT` klaim atas nama dirinya sendiri.
-   Karyawan hanya dapat mengubah klaim miliknya ketika status
    mengizinkan, dan tidak boleh mengubah kolom sensitif seperti
    `employee_id`, `claim_number`, `approval_status`, `payment_status`,
    `decided_by`, atau `decided_at`.
-   Hanya Bos dapat membaca seluruh klaim, melakukan keputusan,
    mengelola kategori, mengelola akun sesuai implementasi, dan mencatat
    pembayaran.
-   Jangan bergantung pada frontend untuk menjaga role atau status.
-   Jangan pernah menaruh `SUPABASE_SERVICE_ROLE_KEY` di variabel
    frontend atau bundle browser. Operasi administratif Auth dilakukan
    melalui server/Edge Function yang terlindungi atau prosedur setup
    aman.
-   Gunakan bucket private dan Storage policies yang membatasi akses
    file berdasarkan klaim.
-   Signed URL harus berumur pendek dan dibuat hanya setelah otorisasi.
-   Hindari menyimpan token, password, atau URL file sensitif dalam log.
-   Terapkan validasi di frontend dan ulangi validasi penting di
    database/backend.
-   Jangan mengirim data pribadi atau isi bukti transaksi ke layanan
    eksternal yang tidak diperlukan.
-   Catat tindakan sensitif di audit trail.
-   Jangan membuat kebijakan RLS `USING (true)` untuk data privat.
-   Tambahkan tes negatif: karyawan A mencoba membaca/mengubah klaim
    karyawan B, mengubah role, menyetujui klaim, atau membuat
    pembayaran; semua harus ditolak.

## 10. Persyaratan Non-Fungsional

### Performa

-   Gunakan pagination untuk daftar.
-   Pilih kolom yang diperlukan, hindari query berulang yang tidak
    perlu.
-   Optimalkan preview dan upload file.
-   Dashboard menggunakan agregasi database yang benar; jangan mengunduh
    seluruh klaim untuk menjumlahkan data di browser.

### Aksesibilitas

-   Label form yang eksplisit.
-   Fokus keyboard terlihat.
-   Kontras warna memadai.
-   Pesan validasi terkait dengan field.
-   Status tidak hanya dibedakan dengan warna.

### Keandalan

-   Tampilkan loading, error, retry, dan empty state.
-   Hindari double submit.
-   Gunakan transaksi database untuk perubahan status/pembayaran yang
    saling terkait.
-   Tangani sesi kedaluwarsa dan kegagalan jaringan.
-   Jangan menghapus data yang telah diproses.

### Kompatibilitas

-   Browser modern pada Android, iOS, Windows, dan macOS.
-   Mobile-first untuk lebar 360 px ke atas.
-   Tablet dan desktop didukung.
-   Tidak wajib menjadi PWA pada versi pertama, kecuali diputuskan
    kemudian.

### Pemeliharaan

-   TypeScript strict.
-   Komponen UI reusable.
-   Pemisahan komponen, halaman, service/data access, dan validasi.
-   Migration SQL disimpan di repository.
-   File `.env.example` disediakan tanpa secret.
-   Dokumentasikan setup lokal, setup Supabase, migration, seed,
    testing, dan deployment.

## 11. Arahan UI Visual

Gunakan desain profesional, bersih, modern, dan mudah digunakan untuk
aplikasi internal perusahaan. Hindari dekorasi berlebihan.

-   Mobile-first.
-   Latar netral, permukaan kartu jelas, hierarki teks konsisten.
-   Warna status konsisten: menunggu = amber, disetujui/dibayar = hijau,
    ditolak/error = merah, revisi = biru/amber sesuai sistem desain.
-   Sertakan label teks di setiap badge status.
-   Tombol aksi utama jelas dan mudah disentuh.
-   Form panjang dibagi menjadi kelompok informasi yang masuk akal.
-   Di ponsel, gunakan kartu untuk daftar klaim; desktop dapat
    menggunakan tabel.
-   Gunakan bottom navigation untuk rute inti di ponsel dan sidebar di
    desktop.
-   Jangan menampilkan tabel desktop sempit yang memaksa horizontal
    scroll tanpa batas.
-   Jangan menambahkan fitur atau halaman yang tidak dijelaskan dalam
    PRD tanpa alasan dan persetujuan.

## 12. Struktur Folder yang Disarankan

Struktur dapat disesuaikan oleh implementer, tetapi tanggung jawab harus
tetap terpisah.

``` text
src/
  app/
    router/
    providers/
  components/
    ui/
    layout/
    forms/
    reimbursement/
    reports/
  features/
    auth/
    dashboard/
    reimbursements/
    approvals/
    payments/
    reports/
    employees/
    categories/
  lib/
    supabase/
    formatting/
    validation/
    permissions/
  hooks/
  types/
  styles/
supabase/
  migrations/
  seed.sql
docs/
  PRD.md
  SETUP.md
```

Jika `PRD.md` ditempatkan di root repository, jangan menggandakannya ke
`docs/` tanpa kebutuhan. Struktur di atas merupakan panduan, bukan
alasan untuk memindahkan dokumen yang sudah ada secara otomatis.

## 13. Pengujian dan Acceptance Criteria

### Autentikasi

-   [ ] Pengguna yang belum login tidak dapat membuka halaman privat.
-   [ ] Karyawan diarahkan ke area karyawan; Bos diarahkan ke area Bos.
-   [ ] Pengguna tidak dapat mengubah role lewat browser.
-   [ ] Pendaftaran publik tidak memberikan akses.

### Pengajuan

-   [ ] Karyawan dapat mengirim klaim valid dengan bukti.
-   [ ] Klaim tanpa tanggal, kategori, nominal valid, keterangan, atau
    bukti tidak dapat dikirim.
-   [ ] Nominal nol/negatif ditolak.
-   [ ] Identitas pengaju selalu berasal dari sesi login.
-   [ ] Klaim tersimpan dan tampil pada riwayat setelah refresh.

### Persetujuan

-   [ ] Bos dapat menyetujui klaim valid.
-   [ ] Penolakan dan revisi tanpa catatan ditolak.
-   [ ] Klaim revisi dapat diperbaiki dan dikirim ulang.
-   [ ] Riwayat keputusan sebelumnya tetap tersedia.
-   [ ] Karyawan tidak dapat memanggil endpoint/SQL untuk menyetujui
    klaim.

### Pembayaran

-   [ ] Klaim belum disetujui tidak dapat dibayar.
-   [ ] Klaim yang sudah dibayar tidak dapat dibayar ulang.
-   [ ] Nominal pembayaran harus sesuai dengan nominal disetujui pada
    versi awal.
-   [ ] Setelah pembayaran tercatat, status dan audit terbarui secara
    atomik.
-   [ ] Karyawan tidak dapat membuat atau mengubah catatan pembayaran.

### Laporan

-   [ ] Filter yang sama menghasilkan kumpulan data yang sama pada UI,
    Excel, dan PDF.
-   [ ] Excel berformat `.xlsx` dan bisa dibuka pada aplikasi
    spreadsheet umum.
-   [ ] PDF berformat `.pdf`, memiliki judul, periode, ringkasan, tabel,
    total, dan nomor halaman.
-   [ ] Data kosong ditangani dengan pesan yang tepat.
-   [ ] Ekspor hanya tersedia bagi Bos.
-   [ ] Total diajukan, disetujui, dan dibayar tidak tercampur.

### Mobile dan desktop

-   [ ] Tidak ada overflow horizontal pada viewport 360 px untuk halaman
    umum.
-   [ ] Form mudah digunakan dengan keyboard ponsel.
-   [ ] Tombol penting memiliki area sentuh yang memadai.
-   [ ] Tampilan desktop memanfaatkan ruang dengan baik.
-   [ ] Status loading, error, sukses, dan empty state tersedia.

### Keamanan

-   [ ] RLS aktif di seluruh tabel privat.
-   [ ] Karyawan A tidak dapat membaca klaim karyawan B.
-   [ ] File bukti tidak dapat diakses secara publik.
-   [ ] Service-role key tidak muncul dalam source frontend.
-   [ ] Tindakan penting divalidasi di backend/database.

## 14. Keputusan yang Belum Ditentukan

Jangan mengarang kebijakan perusahaan untuk hal-hal berikut. Gunakan
default yang dinyatakan di bawah dan buat mudah dikonfigurasi jika
relevan.

1.  **Nama perusahaan/logo:** gunakan placeholder konfigurasi sampai
    tersedia.
2.  **Mata uang:** Rupiah (IDR).
3.  **Zona waktu UI:** gunakan `Asia/Jakarta` sebagai default yang dapat
    dikonfigurasi.
4.  **Batas maksimal nominal:** belum ditentukan; jangan membuat batas
    bisnis arbitrer. Tetap validasi nominal positif.
5.  **Batas waktu klaim:** belum ditentukan; jangan menolak klaim
    berdasarkan usia transaksi tanpa kebijakan eksplisit.
6.  **Retensi dokumen:** belum ditentukan; jangan menghapus otomatis.
7.  **Bukti wajib:** minimal satu file saat klaim dikirim.
8.  **Pembayaran:** pembayaran penuh satu kali dicatat Bos setelah
    dibayar di luar aplikasi.
9.  **Sumber dana perusahaan:** tidak menjadi reimbursement tunai kepada
    karyawan secara default.
10. **Hosting:** belum ditentukan. Pastikan konfigurasi environment
    mendukung deployment umum.
11. **PWA:** bukan persyaratan versi pertama.
12. **Email eksternal:** bukan persyaratan versi pertama; pemulihan kata
    sandi mengikuti kemampuan Supabase Auth.

## 15. Instruksi Implementasi untuk Agent

-   Baca dokumen ini sepenuhnya sebelum membuat perubahan kode.
-   Audit repository dan konfigurasi yang sudah ada terlebih dahulu.
-   Pertahankan implementasi yang sudah benar; jangan mengganti stack
    atau melakukan redesign besar tanpa kebutuhan.
-   Buat rencana kerja berdasarkan modul dan acceptance criteria.
-   Implementasikan secara bertahap, bukan membuat seluruh aplikasi
    dalam satu perubahan besar yang tidak dapat ditinjau.
-   Jangan mengklaim fitur selesai jika belum diimplementasikan dan
    diuji.
-   Jangan gunakan data dummy sebagai pengganti integrasi Supabase pada
    fitur produksi.
-   Jangan menaruh secret di frontend.
-   Buat dan tinjau migration SQL serta RLS sebelum menganggap data
    aman.
-   Jalankan pemeriksaan TypeScript, lint, build, dan tes yang tersedia
    setelah perubahan.
-   Jika ada informasi yang belum jelas, ikuti default pada bagian 14
    dan catat asumsi di dokumentasi.
-   Jika instruksi baru bertentangan dengan PRD, jelaskan konflik dan
    minta konfirmasi sebelum mengubah perilaku bisnis penting.
-   Perbarui dokumentasi setup dan status implementasi setelah setiap
    tahap besar.
