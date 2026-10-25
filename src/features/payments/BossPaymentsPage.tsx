import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Reimbursement, PaymentMethod } from '../../types';
import { formatRupiah, formatDate } from '../../lib/formatters';
import {
  Wallet,
  CheckCircle2,
} from 'lucide-react';

export const BossPaymentsPage: React.FC = () => {
  const [unpaidClaims, setUnpaidClaims] = useState<Reimbursement[]>([]);
  const [paidClaims, setPaidClaims] = useState<Reimbursement[]>([]);
  const [activeTab, setActiveTab] = useState<'unpaid' | 'paid'>('unpaid');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modal State for Recording Payment
  const [selectedClaim, setSelectedClaim] = useState<Reimbursement | null>(null);
  const [paidAt, setPaidAt] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadPayments = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('reimbursements')
        .select(`
          id, claim_number, expense_date, amount, approval_status, payment_status, description, payment_source,
          employee:profiles!reimbursements_employee_id_fkey(full_name, email),
          category:categories(name),
          payment:payments(*)
        `)
        .eq('approval_status', 'approved')
        .order('created_at', { ascending: false });

      if (!error && data) {
        const claims = data as unknown as Reimbursement[];
        setUnpaidClaims(claims.filter((c) => c.payment_status === 'unpaid'));
        setPaidClaims(claims.filter((c) => c.payment_status === 'paid'));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const openPaymentModal = (claim: Reimbursement) => {
    setSelectedClaim(claim);
    setPaidAt(new Date().toISOString().split('T')[0]);
    setPaymentMethod('bank_transfer');
    setReferenceNumber('');
    setPaymentNotes('');
    setErrorMessage(null);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClaim) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // Panggil fungsi database atomik record_payment (PRD 8.6 & 9)
      const { error } = await supabase.rpc('record_payment', {
        p_reimbursement_id: selectedClaim.id,
        p_amount: selectedClaim.amount,
        p_paid_at: paidAt,
        p_payment_method: paymentMethod,
        p_reference_number: referenceNumber.trim() || null,
        p_notes: paymentNotes.trim() || null,
      });

      if (error) throw error;

      setActionSuccess(`Pembayaran untuk ${selectedClaim.claim_number} berhasil dicatat!`);
      setSelectedClaim(null);
      loadPayments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mencatat pembayaran';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Pencatatan Pembayaran</h1>
        <p className="text-xs text-slate-500">
          Catat pembayaran penuh yang telah Anda lakukan secara transfer / kas kepada pegawai
        </p>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-xs underline">
            Tutup
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('unpaid')}
          className={`py-3 px-5 text-sm font-bold border-b-2 transition-colors min-h-[44px] flex items-center gap-2 ${
            activeTab === 'unpaid'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Siap Dibayar</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800 font-extrabold">
            {unpaidClaims.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('paid')}
          className={`py-3 px-5 text-sm font-bold border-b-2 transition-colors min-h-[44px] flex items-center gap-2 ${
            activeTab === 'paid'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Riwayat Sudah Lunas</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-800 font-extrabold">
            {paidClaims.length}
          </span>
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-slate-500">
          <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          Memuat data pembayaran...
        </div>
      ) : activeTab === 'unpaid' ? (
        unpaidClaims.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <h2 className="text-base font-bold text-slate-800">Tidak Ada Klaim Menunggu Pembayaran</h2>
            <p className="text-xs text-slate-500 mt-1">
              Semua klaim yang disetujui telah dicatat lunas pembayarannya.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {unpaidClaims.map((claim) => (
              <div
                key={claim.id}
                className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      {claim.claim_number}
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      {claim.employee?.full_name}
                    </span>
                    <span className="text-xs text-slate-400">
                      • {formatDate(claim.expense_date)}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 line-clamp-1">
                    {claim.description}
                  </h3>
                  <div className="text-xs text-slate-500 mt-1">
                    Kategori: {claim.category?.name} • Sumber:{' '}
                    {claim.payment_source === 'personal' ? 'Uang Pribadi' : 'Dana Perusahaan'}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 flex-shrink-0">
                  <div className="text-left sm:text-right">
                    <span className="text-xs text-slate-400 block">Nominal Tagihan</span>
                    <span className="text-base font-extrabold text-slate-900 block">
                      {formatRupiah(claim.amount)}
                    </span>
                  </div>

                  <button
                    onClick={() => openPaymentModal(claim)}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs min-h-[44px] flex items-center gap-1.5 shadow-sm transition-colors"
                  >
                    <Wallet className="w-4 h-4" />
                    <span>Catat Pembayaran</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Paid Claims Tab */
        paidClaims.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
            Belum ada riwayat pembayaran yang dicatat.
          </div>
        ) : (
          <div className="space-y-3">
            {paidClaims.map((claim) => (
              <div
                key={claim.id}
                className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        {claim.claim_number}
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        {claim.employee?.full_name}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mt-1 line-clamp-1">
                      {claim.description}
                    </h3>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-base font-extrabold text-emerald-700 block">
                      {formatRupiah(claim.amount)}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Dibayar pada: {formatDate(claim.payment?.paid_at)}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                  <span>
                    Metode: <strong className="capitalize">{claim.payment?.payment_method === 'cash' ? 'Tunai' : 'Transfer Bank'}</strong>
                    {claim.payment?.reference_number && ` • Ref: ${claim.payment.reference_number}`}
                  </span>
                  <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Lunas 100%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Modal Pencatatan Pembayaran */}
      {selectedClaim && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-600" />
              <span>Catat Pembayaran Reimbursement</span>
            </h3>

            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg">
                {errorMessage}
              </div>
            )}

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div>
                <span className="text-slate-500">Nomor Klaim: </span>
                <span className="font-bold text-slate-800">{selectedClaim.claim_number}</span>
              </div>
              <div>
                <span className="text-slate-500">Penerima: </span>
                <span className="font-bold text-slate-800">{selectedClaim.employee?.full_name}</span>
              </div>
              <div>
                <span className="text-slate-500">Nominal Disetujui: </span>
                <span className="font-extrabold text-emerald-700 text-sm">
                  {formatRupiah(selectedClaim.amount)}
                </span>
              </div>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tanggal Pembayaran <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Metode Pembayaran <span className="text-rose-500">*</span>
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="bank_transfer">Transfer Bank</option>
                  <option value="cash">Tunai (Cash)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor Referensi Transfer / Bukti (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Misal: TRX-9988231 atau No. Resi Bank"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Pembayaran (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Misal: Sudah ditransfer via rekening BCA"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedClaim(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold min-h-[40px]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs min-h-[40px] shadow-sm transition-colors"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Konfirmasi Lunas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
