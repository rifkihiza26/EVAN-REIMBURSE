import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { formatRupiah, formatDate } from '../../lib/formatters';
import { Reimbursement } from '../../types';
import {
  Clock,
  CheckCircle2,
  Wallet,
  ChevronRight,
  TrendingUp,
  FileCheck2,
  ArrowRight,
} from 'lucide-react';

export const BossDashboard: React.FC = () => {
  const [stats, setStats] = useState({
    pendingCount: 0,
    revisionCount: 0,
    unpaidApprovedCount: 0,
    approvedTotalAmount: 0,
    paidTotalAmount: 0,
    rejectedCount: 0,
  });

  const [pendingApprovals, setPendingApprovals] = useState<Reimbursement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('reimbursements')
          .select(`
            id, claim_number, expense_date, amount, approval_status, payment_status, description, payment_source,
            employee:profiles!reimbursements_employee_id_fkey(full_name, employee_code),
            category:categories(name)
          `)
          .order('created_at', { ascending: false });

        if (!error && data) {
          const claims = data as unknown as Reimbursement[];

          const pending = claims.filter((c) => c.approval_status === 'pending');
          const revision = claims.filter((c) => c.approval_status === 'revision');
          const approved = claims.filter((c) => c.approval_status === 'approved');
          const rejected = claims.filter((c) => c.approval_status === 'rejected');
          
          const unpaidApproved = approved.filter((c) => c.payment_status === 'unpaid');
          const paidApproved = approved.filter((c) => c.payment_status === 'paid');

          const approvedSum = approved.reduce((acc, c) => acc + Number(c.amount), 0);
          const paidSum = paidApproved.reduce((acc, c) => acc + Number(c.amount), 0);

          setStats({
            pendingCount: pending.length,
            revisionCount: revision.length,
            unpaidApprovedCount: unpaidApproved.length,
            approvedTotalAmount: approvedSum,
            paidTotalAmount: paidSum,
            rejectedCount: rejected.length,
          });

          setPendingApprovals(pending.slice(0, 5));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboard();
  }, []);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header Panel Pimpinan yang Formal & Profesional */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            <span>Ringkasan Eksekutif</span>
            <span>•</span>
            <span className="text-slate-800 font-bold">PT Rambat Ruang Optima</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Monitoring & Persetujuan Biaya
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Tinjau pengeluaran operasional pegawai, antrean persetujuan, dan pencatatan pembayaran kas/transfer
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to="/boss/approvals"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold text-sm rounded-lg shadow-xs transition-colors min-h-[44px]"
          >
            <FileCheck2 className="w-4 h-4" />
            <span>Antrean Review ({stats.pendingCount})</span>
          </Link>
          <Link
            to="/boss/payments"
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-sm rounded-lg shadow-xs transition-colors min-h-[44px]"
          >
            <Wallet className="w-4 h-4 text-slate-600" />
            <span>Bayar ({stats.unpaidApprovedCount})</span>
          </Link>
        </div>
      </div>

      {/* Grid Metrik Angka Riil (Gaya Dashboard Keuangan Perusahaan) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Antrean Menunggu */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Perlu Persetujuan</span>
            <span className="p-1.5 rounded-md bg-amber-50 text-amber-700">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-slate-900">
              {isLoading ? '-' : stats.pendingCount}
            </div>
            <div className="text-xs text-slate-500 mt-1 font-medium">
              Klaim menunggu verifikasi Bos
            </div>
          </div>
        </div>

        {/* Belum Dibayar */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Siap Dibayar</span>
            <span className="p-1.5 rounded-md bg-orange-50 text-orange-700">
              <Wallet className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-slate-900">
              {isLoading ? '-' : stats.unpaidApprovedCount}
            </div>
            <div className="text-xs text-slate-500 mt-1 font-medium">
              Approved, belum ditransfer
            </div>
          </div>
        </div>

        {/* Total Disetujui */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Disetujui</span>
            <span className="p-1.5 rounded-md bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight text-slate-900">
              {isLoading ? '-' : formatRupiah(stats.approvedTotalAmount)}
            </div>
            <div className="text-xs text-slate-500 mt-1 font-medium">
              Akumulasi anggaran approved
            </div>
          </div>
        </div>

        {/* Total Realisasi Dibayar */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Realisasi Lunas</span>
            <span className="p-1.5 rounded-md bg-blue-50 text-blue-700">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight text-blue-900">
              {isLoading ? '-' : formatRupiah(stats.paidTotalAmount)}
            </div>
            <div className="text-xs text-slate-500 mt-1 font-medium">
              Sudah dicatat lunas
            </div>
          </div>
        </div>
      </div>

      {/* Antrean Verifikasi Utama */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Klaim Membutuhkan Keputusan</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Daftar pengajuan berstatus pending yang perlu segera diverifikasi
            </p>
          </div>
          <Link
            to="/boss/approvals"
            className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1"
          >
            <span>Buka Antrean Lengkap</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-500 font-medium">
            Memuat antrean...
          </div>
        ) : pendingApprovals.length === 0 ? (
          <div className="py-12 text-center px-4">
            <div className="w-10 h-10 bg-slate-100 text-slate-400 rounded-lg flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Semua Klaim Sudah Ditinjau</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Saat ini tidak ada pengajuan baru yang tertahan pada status pending.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pendingApprovals.map((claim) => (
              <div
                key={claim.id}
                className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      {claim.claim_number}
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      {claim.employee?.full_name}
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-500">
                      {formatDate(claim.expense_date)}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 truncate">
                    {claim.description}
                  </h3>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Kategori: {claim.category?.name || 'Umum'} • Sumber:{' '}
                    {claim.payment_source === 'personal' ? 'Uang Pribadi (Talangan)' : 'Dana Kantor'}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <div className="text-left sm:text-right">
                    <span className="text-sm font-bold text-slate-900 block">
                      {formatRupiah(claim.amount)}
                    </span>
                    <span className="text-[11px] text-slate-400">Nominal klaim</span>
                  </div>

                  <Link
                    to={`/boss/reimbursements/${claim.id}`}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <span>Periksa</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
