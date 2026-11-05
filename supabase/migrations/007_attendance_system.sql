-- ==============================================================================
-- MIGRASI 007: FITUR PRESENSI & CHECK-IN KUNJUNGAN DENGAN KAMERA & GPS WATERMARK
-- ==============================================================================

-- 1. Buat Tabel public.attendances
CREATE TABLE IF NOT EXISTS public.attendances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    attendance_type TEXT NOT NULL CHECK (attendance_type IN ('in', 'visit', 'out')),
    title_or_location TEXT NULL, -- Misal "Kantor Pusat", "Proyek Ruko B", "Meeting Klien PT XYZ"
    notes TEXT NULL,            -- Catatan tambahan / hasil kunjungan
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    accuracy_meters NUMERIC(8, 2) NULL,
    address_display TEXT NULL,  -- Geocoding ringkas / alamat
    photo_storage_path TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indeks performa pencarian
CREATE INDEX IF NOT EXISTS idx_attendances_employee_date 
ON public.attendances (employee_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_attendances_timestamp 
ON public.attendances (timestamp DESC);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;

-- 3. Policy RLS
-- Karyawan bisa melihat absensi miliknya sendiri
DROP POLICY IF EXISTS "Employees can view own attendances" ON public.attendances;
CREATE POLICY "Employees can view own attendances"
ON public.attendances FOR SELECT
TO authenticated
USING (
    employee_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'boss')
);

-- Karyawan bisa submit absensi miliknya sendiri
DROP POLICY IF EXISTS "Employees can insert own attendances" ON public.attendances;
CREATE POLICY "Employees can insert own attendances"
ON public.attendances FOR INSERT
TO authenticated
WITH CHECK (
    employee_id = auth.uid()
);

-- Bos bisa melihat seluruh absensi (sudah dicover di policy select di atas)

-- 4. Setup Storage Bucket untuk Foto Presensi
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'attendance-photos',
    'attendance-photos',
    false, -- Private bucket (menggunakan signed url agar aman)
    10485760, -- 10MB
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Storage Policies untuk bucket attendance-photos
DROP POLICY IF EXISTS "Authenticated users can upload attendance photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload attendance photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'attendance-photos' AND
    auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Users can read attendance photos" ON storage.objects;
CREATE POLICY "Users can read attendance photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'attendance-photos'
);
