import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  RefreshCw,
  MapPin,
  AlertCircle,
  CheckCircle2,
  Navigation,
  Send,
  ShieldAlert,
  Info,
  Smartphone,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { capturePhotoWithWatermark, getReverseGeocoding } from '../../lib/attendanceService';
import { AttendanceType, Attendance } from '../../types';

export const EmployeeAttendancePage: React.FC = () => {
  const { user, profile } = useAuth();
  const companyName = import.meta.env.VITE_COMPANY_NAME || 'PT Rambat Ruang Optima';

  // State Modal Izin (Pre-permission dialog)
  const [showPermissionModal, setShowPermissionModal] = useState<boolean>(false);
  const [permissionStep, setPermissionStep] = useState<'prompt' | 'denied' | 'insecure_origin' | 'granted'>('prompt');

  // State Kamera & GPS
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user'); // default selfie
  const [cameraReady, setCameraReady] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number | null } | null>(null);
  const [locationName, setLocationName] = useState<string>('');
  const [isGettingLocation, setIsGettingLocation] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Form State
  const [attendanceType, setAttendanceType] = useState<AttendanceType>('in');
  const [titleLocation, setTitleLocation] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Preview Foto Hasil Watermark
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Riwayat Absensi Hari Ini
  const [todayAttendances, setTodayAttendances] = useState<Attendance[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);

  // Cek apakah konteks aman (HTTPS atau localhost)
  const isSecureContext = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // 1. Ambil Lokasi GPS (Dioptimalkan untuk HP: fallback high accuracy -> standard accuracy)
  const fetchLocation = (): Promise<boolean> => {
    return new Promise((resolve) => {
      setIsGettingLocation(true);
      setGpsError(null);

      if (!navigator.geolocation) {
        setGpsError('Perangkat Anda tidak mendukung fitur lokasi (GPS).');
        setIsGettingLocation(false);
        resolve(false);
        return;
      }

      // Handler saat koordinat sukses didapat
      const handleSuccess = async (pos: GeolocationPosition) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setCoords({ lat: latitude, lng: longitude, accuracy });
        setIsGettingLocation(false);
        setGpsError(null);
        resolve(true);

        // Ambil nama wilayah via reverse geocode
        try {
          const addr = await getReverseGeocoding(latitude, longitude);
          setLocationName(addr);
        } catch {
          setLocationName(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        }
      };

      // Coba pertama: High Accuracy (GPS hardware HP)
      navigator.geolocation.getCurrentPosition(
        handleSuccess,
        (highAccErr) => {
          console.warn('High accuracy GPS gagal di HP, mencoba fallback standard GPS/Network:', highAccErr);
          
          // Jika ditolak izin secara eksplisit (code 1), jangan fallback
          if (highAccErr.code === 1) {
            setGpsError('Akses lokasi ditolak. Buka pengaturan browser di HP Anda dan izinkan akses Lokasi.');
            setPermissionStep('denied');
            setIsGettingLocation(false);
            resolve(false);
            return;
          }

          // Fallback kedua: standard accuracy dengan timeout lebih longgar dan cache 60 detik
          navigator.geolocation.getCurrentPosition(
            handleSuccess,
            (fallbackErr) => {
              console.warn('Fallback geolocation error:', fallbackErr);
              let msg = 'Gagal mengakses GPS. Pastikan Lokasi / GPS di HP Anda sudah dinyalakan.';
              if (fallbackErr.code === 1) {
                msg = 'Akses lokasi ditolak. Harap izinkan akses lokasi di pengaturan browser HP.';
                setPermissionStep('denied');
              } else if (fallbackErr.code === 2) {
                msg = 'Sinyal GPS tidak ditemukan. Pastikan layanan Lokasi (GPS) aktif di setelan HP.';
              } else if (fallbackErr.code === 3) {
                msg = 'Pencarian GPS timeout. Silakan klik tombol "Perbarui GPS" sekali lagi.';
              }
              setGpsError(msg);
              setIsGettingLocation(false);
              resolve(false);
            },
            { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 }
          );
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
      );
    });
  };

  // 2. Mulai Aliran Kamera
  const startCamera = async (facing: 'user' | 'environment'): Promise<boolean> => {
    setCameraError(null);
    setCameraReady(false);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (!isSecureContext) {
        setPermissionStep('insecure_origin');
        setShowPermissionModal(true);
      }
      setCameraError('Kamera memerlukan koneksi aman (HTTPS). Jika mengakses via IP HP, pastikan izin browser diaktifkan.');
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(console.error);
          setCameraReady(true);
        };
      }
      return true;
    } catch (err: unknown) {
      console.warn('Camera error:', err);
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Permission') || msg.includes('NotAllowedError') || msg.includes('denied')) {
        setCameraError('Izin kamera diblokir oleh browser. Harap aktifkan izin kamera di pengaturan browser.');
        setPermissionStep('denied');
        setShowPermissionModal(true);
      } else {
        setCameraError('Tidak dapat membuka kamera. Pastikan kamera tidak digunakan aplikasi lain.');
      }
      setCameraReady(false);
      return false;
    }
  };

  const toggleFacingMode = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Trigger Permintaan Izin Resmi dari Pengguna (User-Gesture)
  const handleRequestPermissions = async () => {
    const locOk = await fetchLocation();
    const camOk = await startCamera(facingMode);

    if (camOk && locOk) {
      setShowPermissionModal(false);
      setPermissionStep('granted');
    }
  };

  const loadTodayHistory = async () => {
    if (!user) return;
    setIsLoadingHistory(true);
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('attendances')
        .select('*')
        .eq('employee_id', user.id)
        .gte('timestamp', todayStart.toISOString())
        .order('timestamp', { ascending: false });

      if (error) throw error;

      const withUrls: Attendance[] = [];
      if (data) {
        for (const item of data) {
          const { data: signed } = await supabase.storage
            .from('attendance-photos')
            .createSignedUrl(item.photo_storage_path, 3600);
          withUrls.push({ ...item, signed_photo_url: signed?.signedUrl });
        }
      }
      setTodayAttendances(withUrls);
    } catch (err) {
      console.error('Error fetching today history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    // Pada Safari iOS, navigator.permissions.query sering kali tidak mengizinkan query 'geolocation'
    // atau mengembalikan status tidak akurat sehingga memicu status "denied" palsu.
    // Solusi standar industri untuk iOS & Android: langsung panggil API aslinya secara natural.
    fetchLocation();
    startCamera('user');
    loadTodayHistory();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleCapturePhoto = async () => {
    if (!videoRef.current || !cameraReady) {
      setShowPermissionModal(true);
      return;
    }
    if (!coords) {
      alert('Sistem sedang mendeteksi lokasi GPS Anda. Harap tunggu sebentar atau klik tombol Perbarui GPS.');
      fetchLocation();
      return;
    }

    if (attendanceType === 'visit' && !titleLocation.trim()) {
      alert('Untuk tipe check-in kunjungan, tuliskan nama tempat atau keperluan kunjungan terlebih dahulu.');
      return;
    }

    setIsCapturing(true);
    try {
      const blob = await capturePhotoWithWatermark({
        videoElement: videoRef.current,
        companyName,
        employeeName: profile?.full_name || 'Karyawan',
        employeeCode: profile?.employee_code,
        attendanceType,
        titleOrLocation: titleLocation.trim(),
        latitude: coords.lat,
        longitude: coords.lng,
        accuracyMeters: coords.accuracy,
        addressDisplay: locationName,
      });

      setCapturedBlob(blob);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (err: unknown) {
      console.error(err);
      alert('Gagal mengambil foto: ' + (err instanceof Error ? err.message : 'Terjadi kendala'));
    } finally {
      setIsCapturing(false);
    }
  };

  const handleRetake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setCapturedBlob(null);
  };

  const handleSubmitAttendance = async () => {
    if (!user || !capturedBlob || !coords) return;

    setIsSubmitting(true);
    setSubmitSuccess(null);

    try {
      const timestamp = new Date().toISOString();
      const safeId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const storagePath = `${user.id}/${safeId}.jpg`;

      const { error: uploadErr } = await supabase.storage
        .from('attendance-photos')
        .upload(storagePath, capturedBlob, { contentType: 'image/jpeg' });

      if (uploadErr) throw uploadErr;

      const { error: insertErr } = await supabase.from('attendances').insert({
        employee_id: user.id,
        attendance_type: attendanceType,
        title_or_location:
          attendanceType === 'visit'
            ? titleLocation.trim()
            : attendanceType === 'in'
            ? 'Presensi Masuk Harian'
            : 'Presensi Pulang Harian',
        notes: notes.trim() || null,
        timestamp,
        latitude: coords.lat,
        longitude: coords.lng,
        accuracy_meters: coords.accuracy,
        address_display: locationName || null,
        photo_storage_path: storagePath,
      });

      if (insertErr) throw insertErr;

      handleRetake();
      setTitleLocation('');
      setNotes('');
      setSubmitSuccess('Presensi Anda berhasil dicatat dengan bukti foto & koordinat GPS!');
      loadTodayHistory();
      setTimeout(() => setSubmitSuccess(null), 5000);
    } catch (err: unknown) {
      console.error(err);
      alert('Gagal menyimpan presensi: ' + (err instanceof Error ? err.message : 'Terjadi kesalahan sistem'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* MODAL POP-UP PERIZINAN KAMERA & LOKASI */}
      {showPermissionModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4 animate-scale-in">
            {permissionStep === 'insecure_origin' ? (
              <>
                <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                  <Smartphone className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Perhatian: Akses IP di HP</h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Browser modern (Chrome/Safari) secara default hanya memperbolehkan akses kamera pada <strong>HTTPS</strong> atau <strong>localhost</strong>.
                  </p>
                </div>
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-left text-xs text-amber-900 space-y-1.5">
                  <p className="font-semibold">Opsi Pengujian:</p>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] text-amber-800">
                    <li>Buka langsung di laptop via <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">localhost:5173</code> (Kamera & GPS langsung aktif).</li>
                    <li>Atau jika di HP Chrome: buka <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">chrome://flags/#unsafely-treat-insecure-origin-as-secure</code>, masukkan <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">http://192.168.1.12:5173</code>, pilih Enabled & Relaunch.</li>
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPermissionModal(false)}
                  className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm"
                >
                  Saya Mengerti
                </button>
              </>
            ) : permissionStep === 'denied' ? (
              <>
                <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Izin Kamera / Lokasi Ditolak</h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Browser Anda telah memblokir izin kamera atau GPS. Untuk melakukan presensi, aktifkan izin di pengaturan peramban (browser).
                  </p>
                </div>
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-left text-xs space-y-1.5 text-slate-700">
                  <p className="font-bold flex items-center gap-1.5 text-slate-900">
                    <HelpCircle className="w-4 h-4 text-blue-600" />
                    <span>Langkah Mengaktifkan Ulang:</span>
                  </p>
                  <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-600">
                    <li>Klik ikon <strong>Gembok / Setelan Situs</strong> di sebelah kiri bilah alamat browser (URL).</li>
                    <li>Pilih menu <strong>Izin (Permissions)</strong>.</li>
                    <li>Ubah <strong>Kamera</strong> dan <strong>Lokasi</strong> menjadi <strong>"Izinkan" (Allow)</strong>.</li>
                    <li>Muat ulang (refresh) halaman ini.</li>
                  </ol>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPermissionStep('prompt');
                      handleRequestPermissions();
                    }}
                    className="flex-1 py-3 bg-blue-700 hover:bg-blue-800 text-white rounded-xl font-bold text-xs"
                  >
                    Coba Minta Izin Lagi
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPermissionModal(false)}
                    className="py-3 px-4 border border-slate-300 text-slate-700 rounded-xl font-semibold text-xs"
                  >
                    Tutup
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                  <Camera className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Izin Akses Kamera & Lokasi</h3>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    Fitur presensi <strong>{companyName}</strong> memerlukan izin akses kamera langsung dan koordinat GPS untuk mencetak watermark digital resmi pada foto absensi Anda.
                  </p>
                </div>
                <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl text-left text-xs text-blue-900 space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>Kamera: Memotret bukti fisik langsung di lokasi</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>GPS: Memastikan titik kehadiran valid & anti-fraud</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">
                  Klik tombol di bawah, lalu pilih <strong>"Izinkan" (Allow)</strong> saat browser menampilkan kotak dialog perizinan.
                </p>
                <button
                  type="button"
                  onClick={handleRequestPermissions}
                  className="w-full py-3.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  <span>Aktifkan Kamera & Lokasi Sekarang</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Header Halaman */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Presensi & Kunjungan Lapangan</h1>
          <p className="text-xs text-slate-500">
            Foto langsung dengan watermark otomatis (waktu, nama, logo & koordinat GPS)
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setPermissionStep('prompt');
            setShowPermissionModal(true);
          }}
          className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 p-2 rounded-lg hover:bg-blue-50"
        >
          <Info className="w-4 h-4" />
          <span className="hidden sm:inline">Pengaturan Izin</span>
        </button>
      </div>

      {submitSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{submitSuccess}</span>
        </div>
      )}

      {/* CARD FORM PRESENSI */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-5">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Pilih Jenis Presensi / Check-In
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setAttendanceType('in')}
              className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                attendanceType === 'in'
                  ? 'border-emerald-600 bg-emerald-50/80 text-emerald-800 font-bold shadow-sm ring-2 ring-emerald-500/20'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-600'
              }`}
            >
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              <span className="text-xs sm:text-sm">Absen Masuk</span>
            </button>

            <button
              type="button"
              onClick={() => setAttendanceType('visit')}
              className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                attendanceType === 'visit'
                  ? 'border-blue-600 bg-blue-50/80 text-blue-800 font-bold shadow-sm ring-2 ring-blue-500/20'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-600'
              }`}
            >
              <span className="w-3 h-3 rounded-full bg-blue-500"></span>
              <span className="text-xs sm:text-sm">Kunjungan / Lokasi</span>
            </button>

            <button
              type="button"
              onClick={() => setAttendanceType('out')}
              className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                attendanceType === 'out'
                  ? 'border-rose-600 bg-rose-50/80 text-rose-800 font-bold shadow-sm ring-2 ring-rose-500/20'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-600'
              }`}
            >
              <span className="w-3 h-3 rounded-full bg-rose-500"></span>
              <span className="text-xs sm:text-sm">Absen Pulang</span>
            </button>
          </div>
        </div>

        {attendanceType === 'visit' && (
          <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2">
            <label className="block text-xs font-bold text-blue-900">
              Nama Tempat / Klien / Proyek yang Dikunjungi <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Proyek Ruko BSD, Kantor Klien PT ABC, Toko Bahan Bangunan..."
              value={titleLocation}
              onChange={(e) => setTitleLocation(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-blue-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-slate-900"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Catatan Aktivitas / Pekerjaan <span className="text-slate-400 font-normal">(Opsional)</span>
          </label>
          <input
            type="text"
            placeholder="Misal: Pengecekan progres instalasi listrik lantai 2..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-slate-800"
          />
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5 overflow-hidden">
            <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              {isGettingLocation ? (
                <span className="text-slate-500 animate-pulse">Sedang mengunci sinyal GPS...</span>
              ) : coords ? (
                <div>
                  <p className="font-semibold text-slate-800 truncate">
                    {locationName || `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Lat: {coords.lat.toFixed(6)}, Lng: {coords.lng.toFixed(6)}
                    {coords.accuracy && ` (akurasi ±${Math.round(coords.accuracy)}m)`}
                  </p>
                </div>
              ) : (
                <span className="text-rose-600 font-medium">Lokasi GPS belum didapatkan</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={fetchLocation}
            disabled={isGettingLocation}
            className="flex-shrink-0 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-medium flex items-center gap-1 transition-colors min-h-[36px]"
          >
            <Navigation className={`w-3.5 h-3.5 ${isGettingLocation ? 'animate-spin text-blue-600' : ''}`} />
            <span>{isGettingLocation ? 'Mencari...' : 'Perbarui GPS'}</span>
          </button>
        </div>

        {gpsError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{gpsError}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setPermissionStep('prompt');
                setShowPermissionModal(true);
              }}
              className="text-xs font-bold underline flex-shrink-0 text-rose-800"
            >
              Panduan Izin
            </button>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              {previewUrl ? 'Hasil Foto dengan Watermark' : 'Kamera Presensi Langsung'}
            </label>
            {!previewUrl && (
              <button
                type="button"
                onClick={toggleFacingMode}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-blue-50 border border-blue-200 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Ganti Kamera ({facingMode === 'user' ? 'Depan' : 'Belakang'})</span>
              </button>
            )}
          </div>

          <div className="relative w-full aspect-[4/3] bg-slate-900 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center">
            {cameraError ? (
              <div className="p-6 text-center text-white space-y-3">
                <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
                <p className="text-sm font-semibold">{cameraError}</p>
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPermissionStep('prompt');
                      setShowPermissionModal(true);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
                  >
                    Buka Panduan & Minta Izin
                  </button>
                  <button
                    type="button"
                    onClick={() => startCamera(facingMode)}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-semibold"
                  >
                    Coba Hubungkan Lagi
                  </button>
                </div>
              </div>
            ) : previewUrl ? (
              <div className="relative w-full h-full">
                <img
                  src={previewUrl}
                  alt="Preview Presensi"
                  className="w-full h-full object-contain bg-black"
                />
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                />
                <div className="absolute inset-8 border-2 border-white/40 border-dashed rounded-2xl pointer-events-none flex flex-col justify-between p-3">
                  <div className="flex justify-between text-[11px] font-bold text-white/80 bg-slate-900/60 px-2.5 py-1 rounded-full self-start backdrop-blur-sm">
                    {companyName}
                  </div>
                  <div className="text-center text-xs text-white/90 bg-slate-900/60 py-1 px-3 rounded-full self-center backdrop-blur-sm">
                    Arahkan wajah atau area lokasi ke dalam bingkai
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="pt-2">
          {previewUrl ? (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleRetake}
                disabled={isSubmitting}
                className="flex-1 py-3 px-4 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors text-sm min-h-[48px]"
              >
                Foto Ulang
              </button>
              <button
                type="button"
                onClick={handleSubmitAttendance}
                disabled={isSubmitting}
                className="flex-[2] py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm transition-colors text-sm flex items-center justify-center gap-2 min-h-[48px] disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Mengirim Presensi...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Kirim & Simpan Presensi</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleCapturePhoto}
              disabled={isCapturing}
              className={`w-full py-3.5 px-4 rounded-xl font-bold text-white text-base shadow-sm transition-all flex items-center justify-center gap-2 min-h-[50px] ${
                attendanceType === 'in'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : attendanceType === 'visit'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              } disabled:opacity-50`}
            >
              <Camera className="w-5 h-5" />
              <span>
                {isCapturing
                  ? 'Memproses Watermark...'
                  : attendanceType === 'in'
                  ? 'Ambil Foto Absen Masuk'
                  : attendanceType === 'visit'
                  ? 'Ambil Foto Check-in Kunjungan'
                  : 'Ambil Foto Absen Pulang'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* TIMELINE AKTIVITAS HARI INI */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900">Riwayat Presensi Hari Ini</h2>
          <span className="text-xs text-slate-500 font-medium">
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
          </span>
        </div>

        {isLoadingHistory ? (
          <div className="py-8 text-center text-slate-400 text-sm">Memuat data presensi...</div>
        ) : todayAttendances.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">
            Belum ada catatan presensi hari ini. Silakan lakukan Absen Masuk di atas.
          </div>
        ) : (
          <div className="space-y-4">
            {todayAttendances.map((item) => {
              const time = new Date(item.timestamp).toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
              });

              const isEntry = item.attendance_type === 'in';
              const isVisit = item.attendance_type === 'visit';

              return (
                <div
                  key={item.id}
                  className="flex gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white transition-colors"
                >
                  {item.signed_photo_url ? (
                    <a
                      href={item.signed_photo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0 bg-black relative group"
                    >
                      <img
                        src={item.signed_photo_url}
                        alt="Bukti Absensi"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </a>
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0 text-slate-400">
                      <Camera className="w-6 h-6" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          isEntry
                            ? 'bg-emerald-100 text-emerald-800'
                            : isVisit
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {isEntry ? 'Masuk' : isVisit ? 'Kunjungan' : 'Pulang'}
                      </span>
                      <span className="text-xs font-bold text-slate-700">{time} WIB</span>
                    </div>

                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {item.title_or_location || (isEntry ? 'Absen Masuk' : 'Absen Pulang')}
                    </p>

                    {item.notes && (
                      <p className="text-xs text-slate-600 line-clamp-1 italic">"{item.notes}"</p>
                    )}

                    <div className="flex items-center gap-1 text-[11px] text-slate-500 truncate">
                      <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{item.address_display || `${item.latitude}, ${item.longitude}`}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
