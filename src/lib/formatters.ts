import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';

/**
 * Format angka ke mata uang Rupiah Indonesia
 * Contoh: 150000 -> "Rp150.000"
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format tanggal standar UI (Asia/Jakarta lokal)
 * Contoh: "2026-10-25" -> "25 Okt 2026"
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    const d = typeof dateString === 'string' ? parseISO(dateString) : new Date(dateString);
    return format(d, 'd MMM yyyy', { locale: id });
  } catch {
    return dateString;
  }
}

/**
 * Format tanggal dan waktu untuk audit log
 * Contoh: "25 Okt 2026, 14:30 WIB"
 */
export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    const d = typeof dateString === 'string' ? parseISO(dateString) : new Date(dateString);
    return format(d, 'd MMM yyyy, HH:mm', { locale: id }) + ' WIB';
  } catch {
    return dateString;
  }
}

/**
 * Format ukuran file ke byte, KB, atau MB
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
