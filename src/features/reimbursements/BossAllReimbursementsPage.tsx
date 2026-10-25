import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Reimbursement } from '../../types';
import { formatRupiah, formatDate } from '../../lib/formatters';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Search } from 'lucide-react';

export const BossAllReimbursementsPage: React.FC = () => {
  const [claims, setClaims] = useState<Reimbursement[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [approvalFilter, setApprovalFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadAllClaims() {
      setIsLoading(true);
      try {
        let query = supabase
          .from('reimbursements')
          .select(`
            id, claim_number, expense_date, amount, approval_status, payment_status, description, payment_source,
            employee:profiles!reimbursements_employee_id_fkey(full_name, email),
            category:categories(name)
          `)
          .order('created_at', { ascending: false });

        if (approvalFilter !== 'all') {
          query = query.eq('approval_status', approvalFilter);
        }
        if (paymentFilter !== 'all') {
          query = query.eq('payment_status', paymentFilter);
        }

        const { data, error } = await query;
        if (!error && data) {
          setClaims(data as unknown as Reimbursement[]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }

    loadAllClaims();
  }, [approvalFilter, paymentFilter]);

  const filteredClaims = claims.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.claim_number.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.employee?.full_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-12">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Semua Pengajuan Pegawai</h1>
        <p className="text-xs text-slate-500">
          Seluruh arsip pengajuan klaim reimbursement dari seluruh karyawan
        </p>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
          <input
            type="text"
            placeholder="Cari nomor klaim, nama pegawai, keterangan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg min-h-[40px]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={approvalFilter}
            onChange={(e) => setApprovalFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white min-h-[40px]"
          >
            <option value="all">Semua Persetujuan</option>
            <option value="pending">Menunggu</option>
            <option value="revision">Revisi</option>
            <option value="approved">Disetujui</option>
            <option value="rejected">Ditolak</option>
            <option value="cancelled">Dibatalkan</option>
          </select>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white min-h-[40px]"
          >
            <option value="all">Semua Pembayaran</option>
            <option value="unpaid">Belum Dibayar</option>
            <option value="paid">Sudah Dibayar</option>
          </select>
        </div>
      </div>

      {/* List Klaim Mobile-First Cards / Responsive Table */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-slate-500">
          <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          Memuat semua klaim...
        </div>
      ) : filteredClaims.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-xs text-slate-500">
          Tidak ada pengajuan ditemukan dengan filter saat ini.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredClaims.map((claim) => (
            <Link
              key={claim.id}
              to={`/boss/reimbursements/${claim.id}`}
              className="block bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-400 hover:shadow-md transition-all"
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
                  <div className="text-base font-extrabold text-slate-900">
                    {formatRupiah(claim.amount)}
                  </div>
                  <div className="text-xs text-slate-400">
                    {formatDate(claim.expense_date)}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 mt-3 text-xs">
                <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-medium">
                  {claim.category?.name}
                </span>

                <div className="flex items-center gap-2">
                  <StatusBadge type="approval" status={claim.approval_status} />
                  {claim.approval_status === 'approved' && (
                    <StatusBadge type="payment" status={claim.payment_status} />
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
