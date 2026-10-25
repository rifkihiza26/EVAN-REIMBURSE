import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Reimbursement } from '../../types';
import { formatRupiah, formatDate } from '../../lib/formatters';
import { StatusBadge } from '../../components/ui/StatusBadge';
import {
  Plus,
  Clock,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Receipt,
  ArrowUpRight,
} from 'lucide-react';

export const EmployeeDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const [recentClaims, setRecentClaims] = useState<Reimbursement[]>([]);
  const [stats, setStats] = useState({
    pendingCount: 0,
    approvedCount: 0,
    revisionCount: 0,
    totalApprovedAmount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      if (!user) return;
      setIsLoading(true);

      try {
        const { data, error } = await supabase
          .from('reimbursements')
          .select('id, claim_number, expense_date, amount, approval_status, payment_status, description, category:categories(name)')
          .eq('employee_id', user.id)
          .order('created_at', { ascending: false });

        if (!error && data) {
          const claims = data as unknown as Reimbursement[];
          setRecentClaims(claims.slice(0, 6));

          const pending = claims.filter((c) => c.approval_status === 'pending').length;
          const revision = claims.filter((c) => c.approval_status === 'revision').length;
          const approved = claims.filter((c) => c.approval_status === 'approved');
          const approvedSum = approved.reduce((acc, c) => acc + Number(c.amount), 0);

          setStats({
            pendingCount: pending,
            approvedCount: approved.length,
            revisionCount: revision,
            totalApprovedAmount: approvedSum,
          });
        }
      } catch (err) {
        console.error('Error loading dashboard:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboardData();
  }, [user]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      {/* Header Halaman yang Bersih & Fungsional */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            <span>Ringkasan Pengajuan</span>
            <span>•</span>
            <span className="text-slate-700">{profile?.employee_code || 'Pegawai'}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {profile?.full_name}
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Kelola dan pantau status klaim pengeluaran operasional Anda
          </p>
        </div>

        <Link
          to="/employee/reimbursements/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold text-sm rounded-lg shadow-sm transition-colors min-h-[44px] flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Pengajuan Baru</span>
        </Link>
      </div>

      {/* Grid Metrik yang Terstruktur (Tanpa Gradien Norak) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Disetujui */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Disetujui</span>
            <span className="p-1.5 rounded-md bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {isLoading ? '-' : formatRupiah(stats.totalApprovedAmount)}
            </div>
            <div className="text-xs text-slate-500 mt-1 font-medium">
              {stats.approvedCount} pengajuan telah disetujui
            </div>
          </div>
        </div>

        {/* Menunggu Persetujuan */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Menunggu Review</span>
            <span className="p-1.5 rounded-md bg-amber-50 text-amber-700">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {isLoading ? '-' : stats.pendingCount}
            </div>
            <div className="text-xs text-slate-500 mt-1 font-medium">
              Sedang dalam antrean Bos
            </div>
          </div>
        </div>

        {/* Perlu Revisi */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Perlu Revisi</span>
            <span className="p-1.5 rounded-md bg-blue-50 text-blue-700">
              <AlertCircle className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {isLoading ? '-' : stats.revisionCount}
            </div>
            <div className="text-xs text-slate-500 mt-1 font-medium">
              {stats.revisionCount > 0 ? (
                <span className="text-blue-700 font-semibold">Memerlukan koreksi berkas</span>
              ) : (
                'Tidak ada catatan revisi'
              )}
            </div>
          </div>
        </div>

        {/* Aksi Cepat / Shortcut */}
        <div className="bg-slate-900 text-white p-5 rounded-xl flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Bantuan Pengajuan
            </span>
            <h3 className="text-sm font-semibold text-white mt-1">
              Ada bukti struk baru?
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Segera foto struk atau invoice nota Anda sebelum rusak atau hilang.
            </p>
          </div>
          <Link
            to="/employee/reimbursements/new"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-300 hover:text-white mt-3 transition-colors"
          >
            <span>Upload Struk Sekarang</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Tabel Pengajuan Terbaru (Sistem ERP / Clean Enterprise) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Daftar Pengajuan Terakhir</h2>
            <p className="text-xs text-slate-500 mt-0.5">Riwayat 6 pengajuan terbaru Anda</p>
          </div>
          <Link
            to="/employee/reimbursements"
            className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1"
          >
            <span>Lihat Semua Riwayat</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-500 font-medium">
            Memuat data pengajuan...
          </div>
        ) : recentClaims.length === 0 ? (
          <div className="py-12 text-center px-4">
            <div className="w-10 h-10 bg-slate-100 text-slate-400 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Receipt className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-slate-800">Belum ada pengajuan klaim</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              Anda belum pernah mencatat reimbursement biaya operasional kantor.
            </p>
            <Link
              to="/employee/reimbursements/new"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-700 text-white text-xs font-semibold rounded-lg hover:bg-blue-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajukan Pertama Kali</span>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentClaims.map((claim) => (
              <Link
                key={claim.id}
                to={`/employee/reimbursements/${claim.id}`}
                className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      {claim.claim_number}
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-500 font-medium">
                      {claim.category?.name || 'Umum'}
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-500">
                      {formatDate(claim.expense_date)}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 truncate">
                    {claim.description}
                  </h3>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <span className="text-sm font-bold text-slate-900">
                    {formatRupiah(claim.amount)}
                  </span>
                  <div className="flex items-center gap-2">
                    <StatusBadge type="approval" status={claim.approval_status} />
                    <ChevronRight className="w-4 h-4 text-slate-400 hidden sm:block" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
