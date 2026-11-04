import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Reimbursement } from '../types';
import { formatDate, formatRupiah, formatDateTime } from './formatters';

interface GeneratePdfOptions {
  title?: string;
  filename?: string;
}

/**
 * Konversi image URL / Signed URL ke Base64 Data URL agar bisa dimasukkan ke jsPDF
 */
async function getBase64ImageFromUrl(url: string): Promise<{ dataUrl: string; width: number; height: number; format: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    
    // Cek format gambar
    const mimeType = blob.type.toLowerCase();
    let format = 'JPEG';
    if (mimeType.includes('png')) format = 'PNG';
    else if (mimeType.includes('webp')) format = 'WEBP';
    else if (!mimeType.includes('jpeg') && !mimeType.includes('jpg')) {
      // Bukan image format yang disupport jsPDF (misal PDF dokumen)
      return null;
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const img = new Image();
        img.onload = () => {
          resolve({
            dataUrl,
            width: img.naturalWidth || img.width || 400,
            height: img.naturalHeight || img.height || 300,
            format,
          });
        };
        img.onerror = () => {
          resolve({ dataUrl, width: 400, height: 300, format });
        };
        img.src = dataUrl;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('Gagal memuat gambar untuk PDF:', err);
    return null;
  }
}

/**
 * Download klaim reimbursement lengkap dalam format PDF rapi,
 * berisi ringkasan, rincian biaya, kendaraan, deskripsi jelas, dan lampiran foto struk beserta keterangannya.
 * Mendukung klaim tunggal (1) maupun multi-klaim (misal 5, 10 klaim).
 */
export async function downloadReimbursementsPdf(
  claims: Reimbursement[],
  options?: GeneratePdfOptions
): Promise<void> {
  if (!claims || claims.length === 0) {
    alert('Tidak ada data klaim yang dipilih untuk di-download.');
    return;
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const companyName = import.meta.env.VITE_COMPANY_NAME || 'PT Rambat Ruang Optima';
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const totalAmount = claims.reduce((acc, c) => acc + Number(c.amount || 0), 0);
  const employeeName = claims[0]?.employee?.full_name || 'Karyawan';
  const employeeCode = claims[0]?.employee?.employee_code || '';

  // ==========================================
  // JIKA MULTI-KLAIM (> 1), BUAT HALAMAN COVER / REKAP DAFTAR
  // ==========================================
  if (claims.length > 1) {
    // Header Dokumen
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(companyName, margin, 18);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 64, 175); // blue-800
    doc.text('BUKTI REKAPITULASI PENGAJUAN REIMBURSEMENT', margin, 25);

    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.5);
    doc.line(margin, 28, pageWidth - margin, 28);

    // Info Ringkas Pegawai & Waktu
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105); // slate-600

    doc.text(`Nama Pegawai : ${employeeName} ${employeeCode ? `(${employeeCode})` : ''}`, margin, 35);
    doc.text(`Waktu Cetak  : ${formatDateTime(new Date().toISOString())}`, margin, 40);
    doc.text(`Jumlah Klaim : ${claims.length} Pengajuan`, margin, 45);

    // Kotak Ringkasan Total
    doc.setFillColor(241, 245, 249); // slate-100
    doc.roundedRect(pageWidth - margin - 75, 31, 75, 16, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('TOTAL REIMBURSEMENT', pageWidth - margin - 70, 37);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(formatRupiah(totalAmount), pageWidth - margin - 70, 44);

    // Tabel Ringkasan
    const summaryRows = claims.map((c, i) => [
      i + 1,
      c.claim_number,
      formatDate(c.expense_date),
      c.category?.name || 'Umum',
      c.vehicle_info || '-',
      c.description.length > 35 ? c.description.substring(0, 32) + '...' : c.description,
      formatRupiah(c.amount),
      c.approval_status.toUpperCase(),
    ]);

    autoTable(doc, {
      startY: 52,
      head: [
        ['No', 'No. Klaim', 'Tanggal', 'Kategori', 'Kendaraan', 'Keterangan', 'Nominal', 'Status'],
      ],
      body: summaryRows,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 64, 175], // blue-800
        textColor: 255,
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 8,
        textColor: 50,
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { fontStyle: 'bold', cellWidth: 26 },
        2: { cellWidth: 22 },
        3: { cellWidth: 22 },
        4: { cellWidth: 25 },
        5: { cellWidth: 'auto' },
        6: { halign: 'right', fontStyle: 'bold', cellWidth: 26 },
        7: { halign: 'center', cellWidth: 20 },
      },
    });

    // Tambahkan halaman baru untuk rincian detail masing-masing klaim
    doc.addPage();
  }

  // ==========================================
  // RINCIAN DETAIL TIAP KLAIM BESERTA FOTO & KETERANGAN FOTO
  // ==========================================
  for (let idx = 0; idx < claims.length; idx++) {
    const claim = claims[idx];

    // Jika bukan klaim pertama pada mode 1 halaman atau klaim berikutnya di multi-klaim
    if (idx > 0) {
      doc.addPage();
    }

    let currentY = 18;

    // Header Perusahaan
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(companyName, margin, currentY);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Formulir Pengajuan & Bukti Pengeluaran Kas/Reimbursement', margin, currentY + 5);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(margin, currentY + 8, pageWidth - margin, currentY + 8);

    currentY += 15;

    // Nomor Klaim & Status Badge
    doc.setFillColor(239, 246, 255); // blue-50
    doc.roundedRect(margin, currentY, contentWidth, 12, 1.5, 1.5, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text(`NOMOR KLAIM: ${claim.claim_number}`, margin + 4, currentY + 7.5);

    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    const statusText = `Status: ${claim.approval_status.toUpperCase()} | ${claim.payment_status === 'paid' ? 'LUNAS DIBAYAR' : 'BELUM DIBAYAR'}`;
    doc.text(statusText, pageWidth - margin - 4 - doc.getTextWidth(statusText), currentY + 7.5);

    currentY += 18;

    // Rincian Informasi Klaim (Tabel Grid Informasi)
    const detailRows = [
      ['Pegawai Pengaju', `${claim.employee?.full_name || employeeName} ${claim.employee?.employee_code ? `(${claim.employee.employee_code})` : ''}`],
      ['Tanggal Pengeluaran', formatDate(claim.expense_date)],
      ['Kategori Pengeluaran', claim.category?.name || 'Umum'],
      ['Kendaraan yang Digunakan', claim.vehicle_info || 'Tidak menggunakan kendaraan / -'],
      ['Sumber Dana', 'Uang Pribadi Pegawai (Talangan)'],
      ['Nominal Penggantian', formatRupiah(claim.amount)],
      ['Keterangan Lengkap', claim.description || '-'],
    ];

    autoTable(doc, {
      startY: currentY,
      body: detailRows,
      theme: 'plain',
      styles: {
        fontSize: 9,
        cellPadding: 2,
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50, textColor: [71, 85, 105] },
        1: { textColor: [15, 23, 42] },
      },
    });

    // Ambil Y terakhir dari autoTable
    // @ts-expect-error autoTable adds lastAutoTable to jsPDF instance
    currentY = (doc.lastAutoTable?.finalY || currentY + 45) + 6;

    // ==========================================
    // LAMPIRAN BUKTI TRANSAKSI (FOTO + KETERANGAN)
    // ==========================================
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`Lampiran Bukti Transaksi (${claim.files?.length || 0} Berkas)`, margin, currentY);

    currentY += 4;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 6;

    const files = claim.files || [];
    if (files.length === 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(148, 163, 184);
      doc.text('Tidak ada foto bukti terlampir.', margin, currentY + 4);
    } else {
      for (let fIdx = 0; fIdx < files.length; fIdx++) {
        const file = files[fIdx];
        const isImage = file.mime_type.startsWith('image/');

        // Cek jika butuh ruang vertikal baru agar foto tidak terpotong di tepi bawah
        if (currentY + 70 > pageHeight - margin) {
          doc.addPage();
          currentY = 20;
        }

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 64, 175);
        doc.text(`Bukti #${fIdx + 1}: ${file.original_filename}`, margin, currentY);
        currentY += 4;

        if (file.caption) {
          doc.setFontSize(8.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(71, 85, 105);
          const captionText = `Keterangan: ${file.caption}`;
          const splitCaption = doc.splitTextToSize(captionText, contentWidth);
          doc.text(splitCaption, margin, currentY);
          currentY += splitCaption.length * 4;
        }

        if (isImage && file.signed_url) {
          try {
            const imgData = await getBase64ImageFromUrl(file.signed_url);
            if (imgData) {
              // Hitung skala foto agar proporsional dan muat rapi di halaman PDF
              const maxImgWidth = Math.min(contentWidth, 120); // lebar maksimum 120 mm
              const maxImgHeight = 85; // tinggi maksimum 85 mm
              
              let renderWidth = maxImgWidth;
              let renderHeight = (imgData.height / imgData.width) * renderWidth;

              if (renderHeight > maxImgHeight) {
                renderHeight = maxImgHeight;
                renderWidth = (imgData.width / imgData.height) * renderHeight;
              }

              // Jika foto ini melebihi sisa tinggi halaman, pindah ke halaman baru
              if (currentY + renderHeight > pageHeight - margin) {
                doc.addPage();
                currentY = 20;
              }

              // Kotak border foto
              doc.setDrawColor(203, 213, 225);
              doc.setFillColor(248, 250, 252);
              doc.roundedRect(margin, currentY, renderWidth + 2, renderHeight + 2, 1, 1, 'FD');

              doc.addImage(imgData.dataUrl, imgData.format, margin + 1, currentY + 1, renderWidth, renderHeight);
              currentY += renderHeight + 8;
            } else {
              doc.setFontSize(8);
              doc.setFont('helvetica', 'italic');
              doc.setTextColor(148, 163, 184);
              doc.text('[Foto tidak dapat dimuat atau format tidak didukung]', margin, currentY + 3);
              currentY += 8;
            }
          } catch (e) {
            console.warn('Gagal render image ke PDF:', e);
            currentY += 8;
          }
        } else {
          // File non-image (misal PDF terlampir)
          doc.setFontSize(8.5);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(100, 116, 139);
          doc.text(`[Dokumen ${file.mime_type.toUpperCase()} terlampir pada sistem]`, margin, currentY + 3);
          currentY += 8;
        }

        currentY += 4;
      }
    }
  }

  // ==========================================
  // FOOTER NOMOR HALAMAN DI SETIAP HALAMAN
  // ==========================================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Halaman ${i} dari ${totalPages} • Dokumen Resmi Reimbursement ${companyName}`,
      margin,
      pageHeight - 8
    );
    doc.text(
      `Dicetak oleh: ${employeeName}`,
      pageWidth - margin - doc.getTextWidth(`Dicetak oleh: ${employeeName}`),
      pageHeight - 8
    );
  }

  // Simpan dan unduh PDF
  const safeFilename = options?.filename || 
    (claims.length === 1 
      ? `Reimbursement-${claims[0].claim_number}.pdf`
      : `Rekap-Reimbursement-${claims.length}-Klaim-${new Date().toISOString().split('T')[0]}.pdf`);

  doc.save(safeFilename);
}
