import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Reimbursement, ApprovalStatus } from '../../types';
import { formatRupiah, formatDate } from '../../lib/formatters';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Search, PlusCircle, CheckCircle2, Receipt } from 'lucide-react';

export const EmployeeReimbursementsPage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  const [claims, setClaims] = useState<Reimbursement[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(
    (location.state as { successMessage?: string })?.successMessage || null
  );

  useEffect(() => {
    async function loadClaims() {
      if (!user) return;
      setIsLoading(true);

      try {
        let query = supabase
          .from('reimbursements')
          .select('id, claim_number, expense_date, amount, approval_status, payment_status, description, category:categories(name)')
          .eq('employee_id', user.id)
          .order('created_at', { ascending: false });

        if (filterStatus !== 'all') {
          query = query.eq('approval_status', filterStatus);
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

    loadClaims();
  }, [user, filterStatus]);

  // Client-side search filter
  const filteredClaims = claims.filter((claim) => {
    const q = searchQuery.toLowerCase();
    return (
      claim.claim_number.toLowerCase().includes(q) ||
      claim.description.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-12">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Riwayat Pengajuan Saya</h1>
          <p className="text-xs text-slate-500">
            Daftar seluruh klaim reimbursement yang telah Anda buat
          </p>
        </div>
        <Link
          to="/employee/reimbursements/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-semibold rounded-xl text-sm shadow-sm hover:bg-emerald-700 min-h-[44px] transition-colors"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Ajukan Baru</span>
        </Link>
      </div>

      {bannerSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-emerald-800 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>{bannerSuccess}</span>
          </div>
          <button
            onClick={() => setBannerSuccess(null)}
            className="text-xs text-emerald-700 hover:text-emerald-900 underline min-h-[32px] px-2"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
          <input
            type="text"
            placeholder="Cari nomor klaim atau keterangan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 min-h-[40px]"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">
            Status:
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-emerald-500 focus:border-emerald-500 min-h-[40px]"
          >
            <option value="all">Semua Status</option>
            <option value="pending">Menunggu Persetujuan</option>
            <option value="revision">Perlu Revisi</option>
            <option value="approved">Disetujui</option>
            <option value="rejected">Ditolak</option>
            <option value="draft">Draf</option>
            <option value="cancelled">Dibatalkan</option>
          </select>
        </div>
      </div>

      {/* Daftar Klaim dalam format Kartu Mobile-First */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-slate-500">
          <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          Memuat daftar pengajuan...
        </div>
      ) : filteredClaims.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
            <Receipt className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-700">Tidak ada pengajuan ditemukan</p>
          <p className="text-xs text-slate-500 mt-1">
            {searchQuery || filterStatus !== 'all'
              ? 'Coba ganti filter atau kata kunci pencarian Anda.'
              : 'Anda belum memiliki riwayat reimbursement.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredClaims.map((claim) => (
            <Link
              key={claim.id}
              to={`/employee/reimbursements/${claim.id}`}
              className="block bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-400 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <span className="text-xs font-mono font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    {claim.claim_number}
                  </span>
                  <h2 className="text-base font-bold text-slate-900 mt-1 line-clamp-1">
                    {claim.description}
                  </h2>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-base font-bold text-slate-900">
                    {formatRupiah(claim.amount)}
                  </div>
                  <div className="text-xs text-slate-400">
                    {formatDate(claim.expense_date)}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 mt-3 text-xs">
                <span className="text-slate-600 bg-slate-100 px-2 py-1 rounded-md font-medium">
                  {claim.category?.name || 'Kategori'}
                </span>

                <div className="flex items-center gap-2">
                  <StatusBadge type="approval" status={claim.approval_status as ApprovalStatus} />
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
