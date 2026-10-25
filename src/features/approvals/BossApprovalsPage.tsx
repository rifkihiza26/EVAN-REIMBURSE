import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Reimbursement } from '../../types';
import { formatRupiah, formatDate } from '../../lib/formatters';
import { CheckCircle2, Search, ArrowRight } from 'lucide-react';

export const BossApprovalsPage: React.FC = () => {
  const [claims, setClaims] = useState<Reimbursement[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadApprovals() {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('reimbursements')
          .select(`
            id, claim_number, expense_date, amount, approval_status, payment_status, description, payment_source,
            employee:profiles!reimbursements_employee_id_fkey(full_name, email),
            category:categories(name)
          `)
          .eq('approval_status', 'pending')
          .order('created_at', { ascending: false });

        if (!error && data) {
          setClaims(data as unknown as Reimbursement[]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }

    loadApprovals();
  }, []);

  const filteredClaims = claims.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.claim_number.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.employee?.full_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-12">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Antrean Persetujuan</h1>
        <p className="text-xs text-slate-500">
          Periksa pengajuan reimbursement dari pegawai yang memerlukan persetujuan Anda
        </p>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Cari berdasarkan nomor klaim, nama pegawai, atau keterangan..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-sm outline-none bg-transparent"
        />
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-slate-500">
          <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          Memuat antrean...
        </div>
      ) : filteredClaims.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <h2 className="text-base font-bold text-slate-800">Tidak Ada Klaim Pending</h2>
          <p className="text-xs text-slate-500 mt-1">
            Semua pengajuan telah diputuskan. Anda dapat melihat arsip di menu Semua Pengajuan.
          </p>
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
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-medium">
                    {claim.category?.name}
                  </span>
                  <span className="text-slate-400">
                    • {claim.payment_source === 'personal' ? 'Uang Pribadi' : 'Dana Perusahaan'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                  <span>Tinjau & Putuskan</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
