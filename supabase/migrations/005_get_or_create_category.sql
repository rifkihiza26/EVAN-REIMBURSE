-- ==============================================================================
-- Function: get_or_create_category
-- Mengizinkan pegawai / pengguna terautentikasi membuat kategori baru secara dinamis
-- tanpa melanggar RLS policies
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_or_create_category(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_trimmed TEXT;
BEGIN
  v_trimmed := trim(p_name);
  IF v_trimmed IS NULL OR v_trimmed = '' THEN
    RAISE EXCEPTION 'Nama kategori tidak boleh kosong';
  END IF;

  -- 1. Cari kategori yang sudah ada (case-insensitive)
  SELECT id INTO v_id
  FROM public.categories
  WHERE LOWER(name) = LOWER(v_trimmed)
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  -- 2. Jika belum ada, buat baru
  INSERT INTO public.categories (name, is_active)
  VALUES (v_trimmed, true)
  ON CONFLICT (LOWER(name)) DO UPDATE
    SET is_active = true
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Berikan izin eksekusi kepada authenticated user
GRANT EXECUTE ON FUNCTION public.get_or_create_category(TEXT) TO authenticated;
