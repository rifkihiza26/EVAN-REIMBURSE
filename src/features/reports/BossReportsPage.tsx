import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Reimbursement, Profile, Category } from '../../types';
import { formatRupiah, formatDate } from '../../lib/formatters';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Filter,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';

export const BossReportsPage: React.FC = () => {
  const [claims, setClaims] = useState<Reimbursement[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filter States
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [approvalStatus, setApprovalStatus] = useState<string>('all');
  const [paymentStatus, setPaymentStatus] = useState<string>('all');

  // Load Metadata
  useEffect(() => {
    async function loadMeta() {
      const [empRes, catRes] = await Promise.all([
        supabase.from('profiles').select('*').order('full_name'),
        supabase.from('categories').select('*').order('name'),
      ]);
      if (empRes.data) setEmployees(empRes.data as Profile[]);
      if (catRes.data) setCategories(catRes.data as Category[]);
    }
    loadMeta();
  }, []);

  // Fetch Report Data based on active filters
  const fetchReportData = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('reimbursements')
        .select(`
          id, claim_number, expense_date, amount, approval_status, payment_status, description, payment_source,
          employee:profiles!reimbursements_employee_id_fkey(full_name, email, employee_code),
          category:categories(name),
          payment:payments(paid_at, payment_method, reference_number)
        `)
        .order('expense_date', { ascending: false });

      if (startDate) query = query.gte('expense_date', startDate);
      if (endDate) query = query.lte('expense_date', endDate);
      if (selectedEmployeeId !== 'all') query = query.eq('employee_id', selectedEmployeeId);
      if (selectedCategoryId !== 'all') query = query.eq('category_id', selectedCategoryId);
      if (approvalStatus !== 'all') query = query.eq('approval_status', approvalStatus);
      if (paymentStatus !== 'all') query = query.eq('payment_status', paymentStatus);

      const { data, error } = await query;
      if (!error && data) {
        setClaims(data as unknown as Reimbursement[]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [startDate, endDate, selectedEmployeeId, selectedCategoryId, approvalStatus, paymentStatus]);

  // Totals Calculation (PRD FR-09: Total diajukan, disetujui, dan dibayar dihitung terpisah)
  const totalSubmitted = claims.reduce((acc, c) => acc + Number(c.amount), 0);
  const totalApproved = claims
    .filter((c) => c.approval_status === 'approved')
    .reduce((acc, c) => acc + Number(c.amount), 0);
  const totalPaid = claims
    .filter((c) => c.payment_status === 'paid')
    .reduce((acc, c) => acc + Number(c.amount), 0);

  // 1. Ekspor Excel (.xlsx)
  const handleExportExcel = () => {
    if (claims.length === 0) {
      alert('Tidak ada data klaim untuk diekspor pada filter yang dipilih.');
      return;
    }

    const rows = claims.map((c, index) => ({
      No: index + 1,
      'Nomor Klaim': c.claim_number,
      'Tanggal Pengeluaran': c.expense_date,
      'Nama Pegawai': c.employee?.full_name || '-',
      'Kode Pegawai': c.employee?.employee_code || '-',
      Kategori: c.category?.name || '-',
      Keterangan: c.description,
      'Sumber Dana': c.payment_source === 'personal' ? 'Uang Pribadi' : 'Dana Perusahaan',
      'Nominal (Rp)': Number(c.amount),
      'Status Persetujuan': c.approval_status.toUpperCase(),
      'Status Pembayaran': c.payment_status.toUpperCase(),
      'Tanggal Bayar': c.payment?.paid_at || '-',
      'Metode Bayar': c.payment?.payment_method || '-',
      'No. Ref Pembayaran': c.payment?.reference_number || '-',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Reimbursement');

    const fileName = `reimbursement-report-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // 2. Ekspor PDF (.pdf) Multi-halaman Rapi
  const handleExportPDF = () => {
    if (claims.length === 0) {
      alert('Tidak ada data klaim untuk diekspor pada filter yang dipilih.');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const companyName = import.meta.env.VITE_COMPANY_NAME || 'PT Perusahaan Sejahtera';
    const printDate = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Header Laporan
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName, 14, 15);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Laporan Rekapitulasi Reimbursement Pegawai', 14, 21);

    doc.setFontSize(9);
    doc.text(`Waktu Cetak: ${printDate} WIB`, 14, 27);
    const filterInfo = `Filter: ${startDate || 'Awal'} s.d. ${endDate || 'Sekarang'} | Karyawan: ${
      selectedEmployeeId === 'all' ? 'Semua' : employees.find((e) => e.id === selectedEmployeeId)?.full_name
    } | Kategori: ${selectedCategoryId === 'all' ? 'Semua' : categories.find((c) => c.id === selectedCategoryId)?.name}`;
    doc.text(filterInfo, 14, 32);

    // Ringkasan Total Box
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 36, 269, 14, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `Total Item: ${claims.length}   |   Total Diajukan: ${formatRupiah(totalSubmitted)}   |   Total Disetujui: ${formatRupiah(
        totalApproved
      )}   |   Total Sudah Dibayar: ${formatRupiah(totalPaid)}`,
      18,
      44
    );

    // Data Tabel
    const tableData = claims.map((c, i) => [
      i + 1,
      c.claim_number,
      formatDate(c.expense_date),
      c.employee?.full_name || '-',
      c.category?.name || '-',
      c.description.length > 35 ? c.description.substring(0, 32) + '...' : c.description,
      c.payment_source === 'personal' ? 'Pribadi' : 'Kantor',
      formatRupiah(c.amount),
      c.approval_status.toUpperCase(),
      c.payment_status.toUpperCase(),
    ]);

    autoTable(doc, {
      startY: 54,
      head: [
        [
          'No',
          'No. Klaim',
          'Tgl Pengeluaran',
          'Pegawai',
          'Kategori',
          'Keterangan',
          'Sumber',
          'Nominal',
          'Persetujuan',
          'Pembayaran',
        ],
      ],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [16, 185, 129], // emerald-500
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8,
      },
      bodyStyles: {
        fontSize: 8,
      },
      didDrawPage: (data) => {
        // Footer: Nomor Halaman
        const pageCount = doc.getNumberOfPages();
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(
          `Halaman ${data.pageNumber} dari ${pageCount}`,
          doc.internal.pageSize.width - 30,
          doc.internal.pageSize.height - 10
        );
      },
    });

    const fileName = `reimbursement-report-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Page Title & Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Laporan & Ekspor Reimbursement</h1>
          <p className="text-xs text-slate-500">
            Filter seluruh data klaim dan unduh laporan resmi dalam format Excel atau PDF
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs shadow-sm transition-colors min-h-[44px]"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Unduh Excel (.xlsx)</span>
          </button>

          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-sm transition-colors min-h-[44px]"
          >
            <FileText className="w-4 h-4" />
            <span>Unduh PDF (.pdf)</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-semibold block">Total Diajukan</span>
          <span className="text-lg font-bold text-slate-900 block mt-1">
            {formatRupiah(totalSubmitted)}
          </span>
          <span className="text-[11px] text-slate-400">{claims.length} klaim dalam filter</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs text-emerald-600 font-semibold block">Total Disetujui</span>
          <span className="text-lg font-bold text-emerald-700 block mt-1">
            {formatRupiah(totalApproved)}
          </span>
          <span className="text-[11px] text-slate-400">Telah diapprove Bos</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs text-blue-600 font-semibold block">Total Sudah Lunas Dibayar</span>
          <span className="text-lg font-bold text-blue-700 block mt-1">
            {formatRupiah(totalPaid)}
          </span>
          <span className="text-[11px] text-slate-400">Telah ditransfer/kas</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
          <Filter className="w-4 h-4 text-emerald-600" />
          <span>Filter Laporan</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div>
            <label className="block text-slate-600 font-medium mb-1">Dari Tanggal</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-2.5 py-2 border border-slate-300 rounded-lg min-h-[38px]"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">Sampai Tanggal</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-2.5 py-2 border border-slate-300 rounded-lg min-h-[38px]"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">Pegawai</label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="w-full px-2.5 py-2 border border-slate-300 rounded-lg min-h-[38px] bg-white"
            >
              <option value="all">Semua Pegawai</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">Kategori</label>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="w-full px-2.5 py-2 border border-slate-300 rounded-lg min-h-[38px] bg-white"
            >
              <option value="all">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">Status Persetujuan</label>
            <select
              value={approvalStatus}
              onChange={(e) => setApprovalStatus(e.target.value)}
              className="w-full px-2.5 py-2 border border-slate-300 rounded-lg min-h-[38px] bg-white"
            >
              <option value="all">Semua Status</option>
              <option value="pending">Menunggu</option>
              <option value="revision">Revisi</option>
              <option value="approved">Disetujui</option>
              <option value="rejected">Ditolak</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">Status Pembayaran</label>
            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              className="w-full px-2.5 py-2 border border-slate-300 rounded-lg min-h-[38px] bg-white"
            >
              <option value="all">Semua Status</option>
              <option value="unpaid">Belum Dibayar</option>
              <option value="paid">Sudah Dibayar</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabel Preview */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-800">
            Pratinjau Data ({claims.length} baris)
          </span>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-sm text-slate-500">
            <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            Memuat data laporan...
          </div>
        ) : claims.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            Tidak ada klaim yang sesuai dengan kombinasi filter yang dipilih.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">No. Klaim</th>
                  <th className="p-3">Tanggal</th>
                  <th className="p-3">Pegawai</th>
                  <th className="p-3">Kategori</th>
                  <th className="p-3">Keterangan</th>
                  <th className="p-3 text-right">Nominal</th>
                  <th className="p-3 text-center">Persetujuan</th>
                  <th className="p-3 text-center">Pembayaran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {claims.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60">
                    <td className="p-3 font-mono font-medium text-emerald-700">
                      {c.claim_number}
                    </td>
                    <td className="p-3">{formatDate(c.expense_date)}</td>
                    <td className="p-3 font-semibold">{c.employee?.full_name}</td>
                    <td className="p-3">{c.category?.name}</td>
                    <td className="p-3 max-w-xs truncate">{c.description}</td>
                    <td className="p-3 text-right font-bold">{formatRupiah(c.amount)}</td>
                    <td className="p-3 text-center">
                      <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100">
                        {c.approval_status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`uppercase text-[10px] font-bold px-2 py-0.5 rounded ${
                          c.payment_status === 'paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {c.payment_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
