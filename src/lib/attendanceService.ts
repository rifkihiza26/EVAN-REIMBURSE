/**
 * Helper untuk reverse geocoding sederhana menggunakan OpenStreetMap Nominatim
 * agar koordinat (lat, lng) dapat diterjemahkan menjadi nama jalan/wilayah singkat.
 */
export async function getReverseGeocoding(lat: number, lng: number): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 detik timeout
    
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      {
        signal: controller.signal,
        headers: {
          'Accept-Language': 'id',
        },
      }
    );
    clearTimeout(timeoutId);

    if (!response.ok) return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    const data = await response.json();
    
    if (data && data.display_name) {
      // Ambil potongan alamat ringkas
      const addr = data.address || {};
      const parts = [
        addr.road || addr.suburb || addr.neighbourhood,
        addr.city || addr.town || addr.municipality || addr.county,
        addr.state,
      ].filter(Boolean);

      return parts.length > 0 ? parts.join(', ') : data.display_name.split(',').slice(0, 3).join(', ');
    }
  } catch {
    // Fallback jika offline atau timeout
  }
  return `GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

interface WatermarkOptions {
  videoElement: HTMLVideoElement;
  companyName: string;
  employeeName: string;
  employeeCode?: string | null;
  attendanceType: 'in' | 'visit' | 'out';
  titleOrLocation?: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  addressDisplay?: string;
}

/**
 * Mengambil frame dari live video kamera, kemudian menggambar watermark timestamp,
 * logo, GPS, alamat, dan data karyawan ke HTML5 Canvas sebelum dikonversi menjadi Blob JPG.
 */
export async function capturePhotoWithWatermark(options: WatermarkOptions): Promise<Blob> {
  const {
    videoElement,
    companyName,
    employeeName,
    employeeCode,
    attendanceType,
    titleOrLocation,
    latitude,
    longitude,
    accuracyMeters,
    addressDisplay,
  } = options;

  const canvas = document.createElement('canvas');
  // Gunakan resolusi native dari video stream (min 1280x720 jika tersedia)
  const width = videoElement.videoWidth || 1280;
  const height = videoElement.videoHeight || 720;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Tidak dapat menginisialisasi canvas context.');

  // 1. Gambar frame video langsung
  ctx.drawImage(videoElement, 0, 0, width, height);

  // 2. Gambar overlay banner watermark di bagian bawah foto
  const bannerHeight = Math.max(140, Math.round(height * 0.22));
  const bannerY = height - bannerHeight;

  // Background overlay semi-transparan gelap (hitam kebiruan elegan)
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)'; // slate-900 with opacity
  ctx.fillRect(0, bannerY, width, bannerHeight);

  // Garis aksen status di bagian atas banner
  const typeColor =
    attendanceType === 'in'
      ? '#10b981' // emerald
      : attendanceType === 'visit'
      ? '#3b82f6' // blue
      : '#f43f5e'; // rose (pulang)
  ctx.fillStyle = typeColor;
  ctx.fillRect(0, bannerY, width, 5);

  // 3. Format Waktu & Tanggal Sekarang (WIB)
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }) + ' WIB';

  const typeLabel =
    attendanceType === 'in'
      ? 'PRESENSI MASUK'
      : attendanceType === 'visit'
      ? `CHECK-IN KUNJUNGAN: ${titleOrLocation || 'Lapangan'}`
      : 'PRESENSI PULANG';

  // 4. Render Teks Watermark
  const paddingX = Math.round(width * 0.03);
  let textY = bannerY + Math.round(bannerHeight * 0.22);
  const baseFontSize = Math.max(14, Math.round(width * 0.022));

  // Baris 1: Header Perusahaan & Badge Status
  ctx.font = `bold ${baseFontSize * 1.15}px sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(companyName.toUpperCase(), paddingX, textY);

  // Badge Status Tipe di kanan atas banner
  ctx.font = `bold ${baseFontSize * 0.95}px sans-serif`;
  ctx.fillStyle = typeColor;
  const typeTextWidth = ctx.measureText(typeLabel.toUpperCase()).width;
  ctx.fillText(typeLabel.toUpperCase(), width - paddingX - typeTextWidth, textY);

  // Baris 2: Tanggal & Waktu Timestamp
  textY += Math.round(baseFontSize * 1.35);
  ctx.font = `600 ${baseFontSize * 0.95}px sans-serif`;
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(`🕒 ${dateStr} • ${timeStr}`, paddingX, textY);

  // Baris 3: Nama Karyawan & NIK
  textY += Math.round(baseFontSize * 1.35);
  ctx.font = `500 ${baseFontSize * 0.88}px sans-serif`;
  ctx.fillStyle = '#cbd5e1'; // slate-300
  const empText = `👤 Karyawan: ${employeeName}${employeeCode ? ` (${employeeCode})` : ''}`;
  ctx.fillText(empText, paddingX, textY);

  // Baris 4: Koordinat GPS & Lokasi Geocoding
  textY += Math.round(baseFontSize * 1.35);
  ctx.font = `normal ${baseFontSize * 0.82}px sans-serif`;
  ctx.fillStyle = '#94a3b8'; // slate-400
  const accText = accuracyMeters ? ` (akurasi ±${Math.round(accuracyMeters)}m)` : '';
  const gpsCoord = `📍 GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}${accText}`;
  const locationLine = addressDisplay ? `${gpsCoord} | ${addressDisplay}` : gpsCoord;
  
  // Truncate jika terlalu panjang untuk lebar layar
  ctx.fillText(locationLine, paddingX, textY, width - paddingX * 2);

  // 5. Konversi Canvas ke JPG Blob
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Gagal mengonversi foto watermark ke format gambar.'));
      },
      'image/jpeg',
      0.9
    );
  });
}
