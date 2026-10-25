import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Upload, X, AlertTriangle, ArrowLeft, CheckCircle2 } from 'lucide-react';

export const NewReimbursementPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [expenseDate, setExpenseDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [categoryName, setCategoryName] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [files, setFiles] = useState<File[]>([]);
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selectedFiles = Array.from(e.target.files);
    
    // Validasi tipe file & ukuran
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    const maxSizeBytes = 10 * 1024 * 1024; // 10 MB per file

    for (const f of selectedFiles) {
      if (!allowedTypes.includes(f.type)) {
        setErrorMessage(`File "${f.name}" tidak didukung. Harap upload gambar JPG, PNG, atau dokumen PDF.`);
        return;
      }
      if (f.size > maxSizeBytes) {
        setErrorMessage(`File "${f.name}" melebihi batas ukuran maksimal 10 MB.`);
        return;
      }
    }

    setErrorMessage(null);
    setFiles((prev) => [...prev, ...selectedFiles]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent, isDraft: boolean = false) => {
    e.preventDefault();
    setErrorMessage(null);

    const numericAmount = parseFloat(amount.replace(/[^0-9]/g, ''));
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMessage('Nominal reimbursement harus lebih besar dari Rp 0.');
      return;
    }

    if (!expenseDate) {
      setErrorMessage('Tanggal pengeluaran wajib diisi.');
      return;
    }

    const trimmedCategory = categoryName.trim();
    if (!trimmedCategory) {
      setErrorMessage('Kategori pengeluaran wajib diisi.');
      return;
    }

    if (!description.trim()) {
      setErrorMessage('Keterangan pengeluaran wajib diisi.');
      return;
    }

    if (!isDraft && files.length === 0) {
      setErrorMessage('Pengajuan klaim wajib menyertakan minimal 1 berkas bukti transaksi.');
      return;
    }

    setIsLoading(true);

    try {
      if (!user) throw new Error('Sesi pengguna tidak valid');

      // 0. Dapatkan atau buat Kategori via RPC yang aman
      const { data: catIdData, error: catRpcError } = await supabase.rpc(
        'get_or_create_category',
        { p_name: trimmedCategory }
      );

      if (catRpcError) throw catRpcError;
      const finalCategoryId = catIdData as string;

      // 1. Generate nomor klaim
      const { data: claimNoData, error: claimNoError } = await supabase.rpc(
        'generate_claim_number'
      );
      if (claimNoError) throw claimNoError;
      const claimNumber = claimNoData as string;

      // 2. Insert reimbursement
      const { data: reimbData, error: reimbError } = await supabase
        .from('reimbursements')
        .insert({
          claim_number: claimNumber,
          employee_id: user.id,
          category_id: finalCategoryId,
          expense_date: expenseDate,
          amount: numericAmount,
          payment_source: 'personal',
          description: description.trim(),
          approval_status: isDraft ? 'draft' : 'pending',
          payment_status: 'unpaid',
          submitted_at: isDraft ? null : new Date().toISOString(),
        })
        .select()
        .single();

      if (reimbError) throw reimbError;
      const reimbursementId = reimbData.id;

      // 3. Upload files to private bucket
      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const safeFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const storagePath = `${user.id}/${reimbursementId}/${safeFileName}`;

        const { error: uploadError } = await supabase.storage
          .from('reimbursement-receipts')
          .upload(storagePath, file, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) throw uploadError;

        // Insert metadata to reimbursement_files
        const { error: fileRecordError } = await supabase
          .from('reimbursement_files')
          .insert({
            reimbursement_id: reimbursementId,
            storage_path: storagePath,
            original_filename: file.name,
            mime_type: file.type,
            file_size: file.size,
            uploaded_by: user.id,
          });

        if (fileRecordError) throw fileRecordError;
      }

      // 4. Record history
      await supabase.from('approval_history').insert({
        reimbursement_id: reimbursementId,
        actor_id: user.id,
        action: isDraft ? 'created' : 'submitted',
        note: isDraft ? 'Draf klaim disimpan' : 'Klaim baru diajukan',
        previous_status: null,
        new_status: isDraft ? 'draft' : 'pending',
      });

      // Redirect ke riwayat
      navigate('/employee/reimbursements', {
        state: { successMessage: `Pengajuan ${claimNumber} berhasil dikirim!` },
      });
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Gagal mengirim pengajuan';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto pb-12">
      {/* Top Bar Navigation */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          to="/employee/dashboard"
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Ajukan Reimbursement</h1>
          <p className="text-xs text-slate-500">
            Isi formulir pengeluaran dan lampirkan bukti pembayaran
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-500 mt-0.5" />
          <div>{errorMessage}</div>
        </div>
      )}

      <form className="space-y-6 bg-white p-5 md:p-8 rounded-2xl border border-slate-200 shadow-sm">
        {/* Tanggal Pengeluaran */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Tanggal Pengeluaran <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            required
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-slate-900 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
          />
        </div>

        {/* Kategori Pengeluaran Bebas (Teks Murni Tanpa Dropdown) */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Kategori Pengeluaran <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="Ketik kategori pengeluaran (misal: Bensin, Parkir, Makan Klien, ATK...)"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-slate-900 focus:ring-blue-500 focus:border-blue-500 min-h-[44px] bg-white text-sm"
          />
        </div>

        {/* Nominal Rupiah */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Nominal Pengeluaran (Rp) <span className="text-rose-500">*</span>
          </label>
          <div className="relative rounded-lg">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 font-medium">
              Rp
            </span>
            <input
              type="text"
              inputMode="numeric"
              required
              value={amount ? Number(amount.replace(/[^0-9]/g, '')).toLocaleString('id-ID') : ''}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="0"
              className="w-full pl-12 pr-3.5 py-2.5 border border-slate-300 rounded-lg text-slate-900 font-semibold focus:ring-blue-500 focus:border-blue-500 min-h-[44px]"
            />
          </div>
        </div>

        {/* Sumber Dana (Otomatis Uang Pribadi) */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Sumber Dana
          </label>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-600"></div>
            <div>
              <span className="text-xs font-bold text-slate-800">Uang Pribadi Pegawai (Talangan Pribadi)</span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Pengeluaran dibayar terlebih dahulu oleh pegawai dan akan digantikan oleh perusahaan setelah disetujui.
              </p>
            </div>
          </div>
        </div>

        {/* Keterangan */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Keterangan / Keperluan <span className="text-rose-500">*</span>
          </label>
          <textarea
            required
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Jelaskan tujuan dan rincian transaksi pengeluaran..."
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-slate-900 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
          />
        </div>

        {/* Berkas Bukti Transaksi */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Bukti Transaksi (Struk / Invoice / Nota) <span className="text-rose-500">*</span>
          </label>
          <p className="text-xs text-slate-500 mb-3">
            Minimal 1 berkas. Format: JPG, PNG, atau PDF (maks. 10 MB per file).
          </p>

          <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-4 text-center cursor-pointer transition-colors relative">
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,application/pdf"
              capture="environment"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center justify-center py-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-700">
                Pilih Berkas atau Ambil Foto Struk
              </p>
              <p className="text-xs text-slate-400 mt-1">Dukung kamera HP dan galeri dokumen</p>
            </div>
          </div>

          {/* List Bukti yang Dipilih */}
          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              {files.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                >
                  <div className="flex items-center gap-2 truncate">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span className="font-medium text-slate-800 truncate">{file.name}</span>
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      ({(file.size / 1024).toFixed(0)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="p-1 text-slate-400 hover:text-rose-600 min-w-[32px] min-h-[32px] flex items-center justify-center rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tombol Aksi */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            disabled={isLoading}
            onClick={(e) => handleSubmit(e, true)}
            className="w-full sm:w-auto px-5 py-3 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 min-h-[44px] transition-colors disabled:opacity-50 text-sm"
          >
            Simpan sebagai Draf
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={(e) => handleSubmit(e, false)}
            className="w-full sm:flex-1 px-5 py-3 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 min-h-[44px] shadow-sm transition-colors disabled:opacity-50 text-sm flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Mengirim...</span>
              </>
            ) : (
              'Kirim Pengajuan'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
