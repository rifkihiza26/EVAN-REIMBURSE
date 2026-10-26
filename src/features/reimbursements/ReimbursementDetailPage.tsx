import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Reimbursement, ReimbursementFile, ApprovalHistoryItem } from '../../types';
import { formatRupiah, formatDate, formatDateTime } from '../../lib/formatters';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ProofViewerCard } from '../../components/reimbursement/ProofViewerCard';
import {
  ArrowLeft,
  AlertCircle,
  Calendar,
  CreditCard,
  Send,
  Ban,
  Clock,
  User,
} from 'lucide-react';

export const ReimbursementDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [claim, setClaim] = useState<Reimbursement | null>(null);
  const [files, setFiles] = useState<ReimbursementFile[]>([]);
  const [history, setHistory] = useState<ApprovalHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Edit / revision fields
  const [isEditingRevision, setIsEditingRevision] = useState(false);
  const [revAmount, setRevAmount] = useState('');
  const [revDescription, setRevDescription] = useState('');
  const [revNote, setRevNote] = useState('');

  const loadDetail = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      // 1. Ambil klaim
      const { data: claimData, error: claimErr } = await supabase
        .from('reimbursements')
        .select(`
          *,
          category:categories(name),
          employee:profiles!reimbursements_employee_id_fkey(full_name, email, employee_code),
          decider:profiles!reimbursements_decided_by_fkey(full_name),
          payment:payments(*)
        `)
        .eq('id', id)
        .single();

      if (claimErr) throw claimErr;
      setClaim(claimData as Reimbursement);
      setRevAmount(String(claimData.amount));
      setRevDescription(claimData.description);

      // 2. Ambil files beserta signed URL berumur pendek (PRD 8.4 & 9)
      const { data: filesData, error: filesErr } = await supabase
        .from('reimbursement_files')
        .select('*')
        .eq('reimbursement_id', id);

      if (!filesErr && filesData) {
        const filesWithSignedUrls: ReimbursementFile[] = [];
        for (const file of filesData) {
          const { data: signedData } = await supabase.storage
            .from('reimbursement-receipts')
            .createSignedUrl(file.storage_path, 3600); // 1 jam validitas

          filesWithSignedUrls.push({
            ...file,
            signed_url: signedData?.signedUrl,
          });
        }
        setFiles(filesWithSignedUrls);
      }

      // 3. Ambil riwayat audit
      const { data: historyData, error: histErr } = await supabase
        .from('approval_history')
        .select(`
          *,
          actor:profiles!approval_history_actor_id_fkey(full_name, role)
        `)
        .eq('reimbursement_id', id)
        .order('created_at', { ascending: true });

      if (!histErr && historyData) {
        setHistory(historyData as ApprovalHistoryItem[]);
      }
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Gagal memuat detail reimbursement';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [id]);

  // Handle Cancel Klaim oleh Pegawai
  const handleCancelClaim = async () => {
    if (!id || !claim) return;
    if (!window.confirm('Apakah Anda yakin ingin membatalkan pengajuan ini?')) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.rpc('cancel_reimbursement', {
        p_reimbursement_id: id,
        p_reason: 'Dibatalkan sendiri oleh karyawan',
      });
      if (error) throw error;

      setActionSuccess('Pengajuan klaim berhasil dibatalkan.');
      loadDetail();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal membatalkan klaim';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Submit Ulang Klaim Revisi
  const handleResubmitRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !claim) return;

    const numericAmount = parseFloat(revAmount.replace(/[^0-9]/g, ''));
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMessage('Nominal harus lebih besar dari 0.');
      return;
    }
    if (!revDescription.trim()) {
      setErrorMessage('Keterangan tidak boleh kosong.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // 1. Update data pokok reimbursement
      const { error: updateErr } = await supabase
        .from('reimbursements')
        .update({
          amount: numericAmount,
          description: revDescription.trim(),
        })
        .eq('id', id);

      if (updateErr) throw updateErr;

      // 2. Call RPC submit_reimbursement
      const { error: submitErr } = await supabase.rpc('submit_reimbursement', {
        p_reimbursement_id: id,
        p_note: revNote.trim() ? `Revisi perbaikan: ${revNote.trim()}` : 'Revisi dikirim ulang oleh pegawai',
      });

      if (submitErr) throw submitErr;

      setActionSuccess('Klaim revisi berhasil dikirim ulang ke Bos.');
      setIsEditingRevision(false);
      loadDetail();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengirim ulang revisi';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 text-center text-slate-500">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-sm">Memuat detail pengajuan...</p>
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-8 max-w-md mx-auto">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900">Klaim Tidak Ditemukan</h2>
        <p className="text-xs text-slate-500 mt-1 mb-5">
          Data klaim mungkin sudah dihapus atau Anda tidak memiliki hak akses.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold"
        >
          Kembali
        </button>
      </div>
    );
  }

  const isOwner = user?.id === claim.employee_id;
  const canCancel = isOwner && (claim.approval_status === 'draft' || claim.approval_status === 'pending');
  const canResubmit = isOwner && claim.approval_status === 'revision';

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Top back bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm font-semibold p-2 -ml-2 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali</span>
        </button>
        <div className="flex items-center gap-2">
          <StatusBadge type="approval" status={claim.approval_status} />
          {claim.approval_status === 'approved' && (
            <StatusBadge type="payment" status={claim.payment_status} />
          )}
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between">
          <span>{actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="text-xs underline">
            Tutup
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-xs underline">
            Tutup
          </button>
        </div>
      )}

      {/* Main Info Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <span className="text-xs font-mono font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">
              {claim.claim_number}
            </span>
            <h1 className="text-xl font-bold text-slate-900 mt-2">
              {claim.description}
            </h1>
          </div>
          <div className="text-left sm:text-right">
            <span className="text-xs text-slate-400 block">Nominal Diajukan</span>
            <span className="text-2xl font-extrabold text-slate-900">
              {formatRupiah(claim.amount)}
            </span>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-xs text-slate-400 block mb-0.5">Pegawai Pengaju</span>
            <div className="flex items-center gap-2 font-semibold text-slate-800">
              <User className="w-4 h-4 text-slate-400" />
              <span>{claim.employee?.full_name}</span>
            </div>
            <span className="text-xs text-slate-500 pl-6 block">
              {claim.employee?.email}
            </span>
          </div>

          <div>
            <span className="text-xs text-slate-400 block mb-0.5">Tanggal Pengeluaran</span>
            <div className="flex items-center gap-2 font-semibold text-slate-800">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span>{formatDate(claim.expense_date)}</span>
            </div>
          </div>

          <div>
            <span className="text-xs text-slate-400 block mb-0.5">Kategori</span>
            <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md font-medium text-xs">
              {claim.category?.name || 'Umum'}
            </span>
          </div>

          <div>
            <span className="text-xs text-slate-400 block mb-0.5">Sumber Dana</span>
            <div className="flex items-center gap-2 font-medium text-slate-800">
              <CreditCard className="w-4 h-4 text-slate-400" />
              <span>
                {claim.payment_source === 'personal'
                  ? 'Uang Pribadi (Minta Reimburse)'
                  : 'Dana Perusahaan (Pertanggungjawaban)'}
              </span>
            </div>
          </div>
        </div>

        {/* Informasi Pembayaran (Jika Sudah Dibayar) */}
        {claim.payment && (
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Informasi Pembayaran
              </span>
              <span className="text-xs font-semibold text-emerald-700">
                Lunas via {claim.payment.payment_method === 'cash' ? 'Tunai (Cash)' : 'Transfer Bank'}
              </span>
            </div>
            <div className="text-sm font-semibold text-slate-800">
              Nominal Dibayarkan: {formatRupiah(claim.payment.amount_paid)}
            </div>
            <div className="text-xs text-slate-600">
              Dibayarkan pada: {formatDate(claim.payment.paid_at)}
              {claim.payment.reference_number && ` • Ref: ${claim.payment.reference_number}`}
            </div>
            {claim.payment.notes && (
              <p className="text-xs text-slate-600 italic">Catatan: {claim.payment.notes}</p>
            )}
          </div>
        )}
      </div>

      {/* Formulir Edit Revisi (jika status revision dan karyawan ingin memperbaiki) */}
      {canResubmit && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <span>Klaim Memerlukan Perbaikan (Revisi)</span>
            </div>
            {!isEditingRevision && (
              <button
                onClick={() => setIsEditingRevision(true)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors min-h-[40px]"
              >
                Edit & Kirim Ulang
              </button>
            )}
          </div>

          {isEditingRevision && (
            <form onSubmit={handleResubmitRevision} className="space-y-4 pt-3 border-t border-amber-200">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nominal Koreksi (Rp)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={Number(revAmount.replace(/[^0-9]/g, '')).toLocaleString('id-ID')}
                  onChange={(e) => setRevAmount(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Keterangan Koreksi
                </label>
                <textarea
                  required
                  rows={2}
                  value={revDescription}
                  onChange={(e) => setRevDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Klarifikasi untuk Bos
                </label>
                <input
                  type="text"
                  placeholder="Misal: Sudah melampirkan nota revisi dan perbaikan nominal"
                  value={revNote}
                  onChange={(e) => setRevNote(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingRevision(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Kirimkan Revisi</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Bukti Fisik Transaksi (Nota / Struk) - Inline Preview dengan Perbesar Nota */}
      <ProofViewerCard files={files} title="Bukti Fisik Transaksi (Nota / Struk)" />

      {/* Riwayat Audit & Keputusan */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Clock className="w-5 h-5 text-slate-600" />
          <span>Jejak Audit & Riwayat Keputusan</span>
        </h2>

        <div className="relative pl-6 border-l-2 border-slate-200 space-y-6">
          {history.map((h) => (
            <div key={h.id} className="relative">
              {/* Dot */}
              <div className="absolute -left-[31px] top-0.5 w-3.5 h-3.5 rounded-full bg-slate-400 border-2 border-white ring-2 ring-slate-100"></div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-800 capitalize">
                    {h.action.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    oleh {h.actor?.full_name} ({h.actor?.role === 'boss' ? 'Bos' : 'Pegawai'})
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  {formatDateTime(h.created_at)}
                </span>
                {h.note && (
                  <div className="mt-2 text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    {h.note}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tombol Pembatalan oleh Pegawai (Jika Draft atau Pending) */}
      {canCancel && (
        <div className="pt-2 flex justify-end">
          <button
            onClick={handleCancelClaim}
            disabled={isSubmitting}
            className="px-4 py-2.5 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors flex items-center gap-1.5 min-h-[44px]"
          >
            <Ban className="w-4 h-4" />
            <span>Batalkan Pengajuan Ini</span>
          </button>
        </div>
      )}
    </div>
  );
};
