import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Reimbursement, ReimbursementFile, ApprovalHistoryItem } from '../../types';
import { formatRupiah, formatDate, formatDateTime } from '../../lib/formatters';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ProofViewerCard } from '../../components/reimbursement/ProofViewerCard';
import {
  ArrowLeft,
  AlertCircle,
  Calendar,
  CreditCard,
  User,
  Clock,
  Check,
  X,
  RotateCcw,
} from 'lucide-react';

export const BossReimbursementDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [claim, setClaim] = useState<Reimbursement | null>(null);
  const [files, setFiles] = useState<ReimbursementFile[]>([]);
  const [history, setHistory] = useState<ApprovalHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Decision Modal State
  const [modalType, setModalType] = useState<'approved' | 'rejected' | 'revision_requested' | null>(null);
  const [decisionNote, setDecisionNote] = useState<string>('');

  const loadDetail = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const { data: claimData, error: claimErr } = await supabase
        .from('reimbursements')
        .select(`
          *,
          category:categories(name),
          employee:profiles!reimbursements_employee_id_fkey(full_name, email, employee_code),
          payment:payments(*)
        `)
        .eq('id', id)
        .single();

      if (claimErr) throw claimErr;
      setClaim(claimData as Reimbursement);

      // Files with signed URLs
      const { data: filesData, error: filesErr } = await supabase
        .from('reimbursement_files')
        .select('*')
        .eq('reimbursement_id', id);

      if (!filesErr && filesData) {
        const filesWithSignedUrls: ReimbursementFile[] = [];
        for (const file of filesData) {
          const { data: signedData } = await supabase.storage
            .from('reimbursement-receipts')
            .createSignedUrl(file.storage_path, 3600);

          filesWithSignedUrls.push({
            ...file,
            signed_url: signedData?.signedUrl,
          });
        }
        setFiles(filesWithSignedUrls);
      }

      // History
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
      const msg = err instanceof Error ? err.message : 'Gagal memuat detail pengajuan';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [id]);

  // Handle Decision
  const handleDecide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !modalType) return;

    if ((modalType === 'rejected' || modalType === 'revision_requested') && !decisionNote.trim()) {
      setErrorMessage(
        modalType === 'rejected'
          ? 'Alasan penolakan wajib diisi.'
          : 'Catatan perbaikan revisi wajib diisi.'
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.rpc('decide_reimbursement', {
        p_reimbursement_id: id,
        p_decision: modalType,
        p_note: decisionNote.trim() || null,
      });

      if (error) throw error;

      setActionSuccess(
        modalType === 'approved'
          ? 'Klaim berhasil disetujui!'
          : modalType === 'rejected'
          ? 'Klaim telah ditolak.'
          : 'Permintaan revisi berhasil dikirim ke pegawai.'
      );

      setModalType(null);
      setDecisionNote('');
      loadDetail();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memproses keputusan';
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
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold"
        >
          Kembali
        </button>
      </div>
    );
  }

  const isPending = claim.approval_status === 'pending';

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
            <span className="text-xs text-slate-400 block mb-0.5">Kategori Pengeluaran</span>
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
                  ? 'Uang Pribadi (Reimburse Tunai)'
                  : 'Dana Perusahaan (Pertanggungjawaban)'}
              </span>
            </div>
            {claim.payment_source === 'company' && (
              <span className="text-[11px] text-amber-600 block mt-1">
                * Transaksi dibayar kantor, tidak diganti uang ke pegawai.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bukti Fisik Transaksi (Nota / Struk) - Inline Preview dengan Perbesar Nota */}
      <ProofViewerCard files={files} title="Bukti Fisik Transaksi (Nota / Struk)" />

      {/* Panel Aksi Keputusan Bos (Hanya muncul jika status pending) */}
      {isPending && (
        <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md space-y-4">
          <div>
            <h2 className="text-base font-bold">Ambil Keputusan Persetujuan</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Sebagai approver tunggal, putuskan persetujuan, penolakan, atau minta revisi berkas.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setModalType('approved')}
              className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm min-h-[44px] flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>Setujui Klaim</span>
            </button>

            <button
              onClick={() => setModalType('revision_requested')}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm min-h-[44px] flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Minta Revisi</span>
            </button>

            <button
              onClick={() => setModalType('rejected')}
              className="flex-1 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm min-h-[44px] flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              <X className="w-4 h-4" />
              <span>Tolak Klaim</span>
            </button>
          </div>
        </div>
      )}

      {/* Riwayat Audit & Timeline */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Clock className="w-5 h-5 text-slate-600" />
          <span>Jejak Audit & Riwayat Keputusan</span>
        </h2>

        <div className="relative pl-6 border-l-2 border-slate-200 space-y-6">
          {history.map((h) => (
            <div key={h.id} className="relative">
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

      {/* Modal Konfirmasi Keputusan */}
      {modalType && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              {modalType === 'approved' && 'Konfirmasi Persetujuan Klaim'}
              {modalType === 'rejected' && 'Konfirmasi Penolakan Klaim'}
              {modalType === 'revision_requested' && 'Minta Perbaikan / Revisi Klaim'}
            </h3>

            <p className="text-xs text-slate-600">
              {modalType === 'approved'
                ? 'Klaim ini akan disetujui sebesar nominal yang diajukan dan masuk ke antrean pembayaran.'
                : modalType === 'rejected'
                ? 'Klaim akan ditolak secara permanen. Anda wajib menyertakan alasan penolakan.'
                : 'Klaim akan dikembalikan ke pegawai untuk diperbaiki. Anda wajib memberikan catatan revisi.'}
            </p>

            <form onSubmit={handleDecide} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {modalType === 'approved' ? 'Catatan Tambahan (Opsional)' : 'Catatan / Alasan (Wajib)'}
                </label>
                <textarea
                  rows={3}
                  required={modalType !== 'approved'}
                  value={decisionNote}
                  onChange={(e) => setDecisionNote(e.target.value)}
                  placeholder={
                    modalType === 'approved'
                      ? 'Tulis pesan opsional untuk pegawai...'
                      : modalType === 'rejected'
                      ? 'Jelaskan mengapa klaim ini ditolak...'
                      : 'Jelaskan bagian mana dari nota atau data yang perlu diperbaiki pegawai...'
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalType(null);
                    setDecisionNote('');
                  }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold min-h-[40px]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-5 py-2 text-white rounded-lg text-xs font-bold min-h-[40px] shadow-sm transition-colors ${
                    modalType === 'approved'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : modalType === 'rejected'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {isSubmitting ? 'Memproses...' : 'Kirim Keputusan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
