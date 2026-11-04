import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Reimbursement, ApprovalStatus, ReimbursementFile } from '../../types';
import { formatRupiah, formatDate } from '../../lib/formatters';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { downloadReimbursementsPdf } from '../../lib/pdfGenerator';
import {
  Search,
  PlusCircle,
  CheckCircle2,
  Receipt,
  FileDown,
  CheckSquare,
  Square,
  Car,
} from 'lucide-react';

export const EmployeeReimbursementsPage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  const [claims, setClaims] = useState<Reimbursement[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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
          .select(`
            id, claim_number, expense_date, amount, approval_status, payment_status, description, vehicle_info,
            category:categories(name),
            employee:profiles!reimbursements_employee_id_fkey(full_name, employee_code)
          `)
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
      claim.description.toLowerCase().includes(q) ||
      (claim.vehicle_info && claim.vehicle_info.toLowerCase().includes(q))
    );
  });

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredClaims.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredClaims.map((c) => c.id));
    }
  };

  /**
   * Mengambil file signed URL lengkap untuk sekumpulan ID klaim
   * lalu mengunduh PDF gabungan rapi
   */
  const handleExportSelectedPdf = async (targetClaimIds: string[]) => {
    if (targetClaimIds.length === 0) {
      alert('Pilih minimal 1 klaim untuk di-download PDF.');
      return;
    }

    setIsExporting(true);
    try {
      const selectedClaims = claims.filter((c) => targetClaimIds.includes(c.id));

      // Fetch files & signed URLs untuk masing-masing klaim
      const fullClaimsWithFiles: Reimbursement[] = [];

      for (const claim of selectedClaims) {
        const { data: filesData } = await supabase
          .from('reimbursement_files')
          .select('*')
          .eq('reimbursement_id', claim.id);

        const filesWithSignedUrls: ReimbursementFile[] = [];
        if (filesData) {
          for (const file of filesData) {
            const { data: signedData } = await supabase.storage
              .from('reimbursement-receipts')
              .createSignedUrl(file.storage_path, 3600);

            filesWithSignedUrls.push({
              ...file,
              signed_url: signedData?.signedUrl,
            });
          }
        }

        fullClaimsWithFiles.push({
          ...claim,
          files: filesWithSignedUrls,
        });
      }

      await downloadReimbursementsPdf(fullClaimsWithFiles);
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat membuat file PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-12">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Riwayat Pengajuan Saya</h1>
          <p className="text-xs text-slate-500">
            Daftar klaim reimbursement dan download dokumen PDF resmi beserta foto struk
          </p>
        </div>
        <div className="flex items-center gap-2">
          {filteredClaims.length > 0 && (
            <button
              type="button"
              disabled={isExporting}
              onClick={() => handleExportSelectedPdf(selectedIds.length > 0 ? selectedIds : filteredClaims.map(c => c.id))}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-xl text-xs shadow-xs transition-colors min-h-[44px]"
              title="Download seluruh klaim atau klaim yang dipilih dalam 1 file PDF tersusun rapih"
            >
              <FileDown className="w-4 h-4" />
              <span>
                {isExporting
                  ? 'Menyiapkan PDF...'
                  : selectedIds.length > 0
                  ? `Download PDF (${selectedIds.length})`
                  : `Download Semua PDF (${filteredClaims.length})`}
              </span>
            </button>
          )}

          <Link
            to="/employee/reimbursements/new"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 text-white font-semibold rounded-xl text-xs shadow-xs hover:bg-emerald-700 min-h-[44px] transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Ajukan Baru</span>
          </Link>
        </div>
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
            placeholder="Cari nomor klaim, kendaraan, atau keterangan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 min-h-[40px]"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">
            Status:
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-blue-500 focus:border-blue-500 min-h-[40px]"
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

      {/* Bar Kontrol Multi-Pilih */}
      {filteredClaims.length > 0 && (
        <div className="flex items-center justify-between px-2 text-xs text-slate-600">
          <button
            type="button"
            onClick={toggleSelectAll}
            className="flex items-center gap-2 font-medium hover:text-blue-700 p-1"
          >
            {selectedIds.length === filteredClaims.length ? (
              <CheckSquare className="w-4 h-4 text-blue-700" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            <span>
              {selectedIds.length === filteredClaims.length
                ? 'Batalkan Pilih Semua'
                : `Pilih Semua (${filteredClaims.length} Klaim)`}
            </span>
          </button>

          {selectedIds.length > 0 && (
            <span className="font-semibold text-blue-800">
              {selectedIds.length} klaim dipilih untuk download gabungan
            </span>
          )}
        </div>
      )}

      {/* Daftar Klaim dalam format Kartu Mobile-First */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-slate-500">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
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
          {filteredClaims.map((claim) => {
            const isSelected = selectedIds.includes(claim.id);

            return (
              <div
                key={claim.id}
                className={`bg-white p-4 sm:p-5 rounded-2xl border transition-all ${
                  isSelected
                    ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-md'
                    : 'border-slate-200 shadow-sm hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox Multi-Select */}
                  <button
                    type="button"
                    onClick={(e) => toggleSelect(claim.id, e)}
                    className="mt-1 text-slate-400 hover:text-blue-700 min-h-[30px] min-w-[30px] flex items-center justify-center"
                    title="Pilih klaim ini untuk diunduh bersamaan"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-blue-700" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-400" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div className="truncate">
                        <span className="text-xs font-mono font-semibold text-blue-800 bg-blue-50 px-2 py-0.5 rounded">
                          {claim.claim_number}
                        </span>
                        <Link
                          to={`/employee/reimbursements/${claim.id}`}
                          className="block text-base font-bold text-slate-900 mt-1 line-clamp-1 hover:text-blue-700 transition-colors"
                        >
                          {claim.description}
                        </Link>
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

                    {/* Info Tambahan: Kendaraan & Kategori */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 mt-2">
                      <span className="bg-slate-100 px-2 py-0.5 rounded font-medium">
                        {claim.category?.name || 'Umum'}
                      </span>

                      {claim.vehicle_info && (
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 px-2 py-0.5 rounded font-medium border border-amber-200/60">
                          <Car className="w-3.5 h-3.5" />
                          <span>{claim.vehicle_info}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 mt-3 text-xs">
                      <div className="flex items-center gap-2">
                        <StatusBadge type="approval" status={claim.approval_status as ApprovalStatus} />
                        {claim.approval_status === 'approved' && (
                          <StatusBadge type="payment" status={claim.payment_status} />
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleExportSelectedPdf([claim.id])}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 p-1 rounded"
                          title="Download PDF klaim ini"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                        <span className="text-slate-300">•</span>
                        <Link
                          to={`/employee/reimbursements/${claim.id}`}
                          className="font-semibold text-slate-700 hover:text-blue-700"
                        >
                          Lihat Detail →
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
