import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Attendance } from '../../types';
import {
  Calendar,
  MapPin,
  Camera,
  ExternalLink,
  Search,
  Filter,
  Clock,
  User,
  X,
} from 'lucide-react';

export const BossAttendanceMonitoringPage: React.FC = () => {
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modal Detail Foto Fullscreen
  const [selectedItem, setSelectedItem] = useState<Attendance | null>(null);

  const loadAttendances = async () => {
    setIsLoading(true);
    try {
      const startOfDay = new Date(`${selectedDate}T00:00:00.000Z`).toISOString();
      const endOfDay = new Date(`${selectedDate}T23:59:59.999Z`).toISOString();

      let query = supabase
        .from('attendances')
        .select(`
          *,
          employee:profiles!attendances_employee_id_fkey(id, full_name, employee_code, email)
        `)
        .gte('timestamp', startOfDay)
        .lte('timestamp', endOfDay)
        .order('timestamp', { ascending: false });

      if (filterType !== 'all') {
        query = query.eq('attendance_type', filterType);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Ambil signed url untuk foto bukti
      const withUrls: Attendance[] = [];
      if (data) {
        for (const item of data) {
          const { data: signed } = await supabase.storage
            .from('attendance-photos')
            .createSignedUrl(item.photo_storage_path, 3600);
          withUrls.push({ ...item, signed_photo_url: signed?.signedUrl });
        }
      }

      setAttendances(withUrls);
    } catch (err) {
      console.error('Error fetching attendances:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAttendances();
  }, [selectedDate, filterType]);

  const filteredAttendances = attendances.filter((item) => {
    const q = searchQuery.toLowerCase();
    const empName = item.employee?.full_name?.toLowerCase() || '';
    const empCode = item.employee?.employee_code?.toLowerCase() || '';
    const loc = item.title_or_location?.toLowerCase() || '';
    const addr = item.address_display?.toLowerCase() || '';
    return empName.includes(q) || empCode.includes(q) || loc.includes(q) || addr.includes(q);
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Monitoring Presensi & Kunjungan Lapangan
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Pantau kehadiran, check-in proyek, dan foto bukti timestamp karyawan secara real-time
          </p>
        </div>
      </div>

      {/* FILTER CONTROLS */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Tanggal */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Jenis Presensi */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="all">Semua Tipe Aktivitas</option>
            <option value="in">Absen Masuk</option>
            <option value="visit">Kunjungan / Check-in Lokasi</option>
            <option value="out">Absen Pulang</option>
          </select>
        </div>

        {/* Pencarian Karyawan */}
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari nama karyawan, kode, atau lokasi proyek..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* LIST PRESENSI */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">
            Daftar Catatan ({filteredAttendances.length})
          </h2>
          <span className="text-xs text-slate-500">
            {new Date(selectedDate).toLocaleDateString('id-ID', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            Memuat data presensi...
          </div>
        ) : filteredAttendances.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            Tidak ada catatan presensi yang cocok dengan filter tanggal ini.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredAttendances.map((item) => {
              const time = new Date(item.timestamp).toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });

              const isEntry = item.attendance_type === 'in';
              const isVisit = item.attendance_type === 'visit';

              const googleMapsUrl = `https://www.google.com/maps?q=${item.latitude},${item.longitude}`;

              return (
                <div
                  key={item.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    {/* Thumbnail Foto */}
                    <button
                      type="button"
                      onClick={() => setSelectedItem(item)}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-slate-200 flex-shrink-0 bg-slate-900 relative group cursor-pointer"
                      title="Klik untuk memperbesar foto bukti"
                    >
                      {item.signed_photo_url ? (
                        <img
                          src={item.signed_photo_url}
                          alt="Foto Presensi"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <Camera className="w-6 h-6" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold">
                        Perbesar
                      </div>
                    </button>

                    {/* Informasi Pegawai & Lokasi */}
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                            isEntry
                              ? 'bg-emerald-100 text-emerald-800'
                              : isVisit
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isEntry ? 'MASUK' : isVisit ? 'KUNJUNGAN PROYEK' : 'PULANG'}
                        </span>
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{time} WIB</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        <span>{item.employee?.full_name}</span>
                        {item.employee?.employee_code && (
                          <span className="text-xs text-slate-400 font-normal">
                            ({item.employee.employee_code})
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-semibold text-slate-700">
                        {item.title_or_location || '-'}
                      </p>

                      {item.notes && (
                        <p className="text-xs text-slate-500 italic">"{item.notes}"</p>
                      )}

                      <div className="flex items-center gap-1 text-[11px] text-slate-500">
                        <MapPin className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                        <span className="truncate">
                          {item.address_display || `${item.latitude}, ${item.longitude}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Tombol Aksi Cepat: Maps & Detail */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors min-h-[36px]"
                    >
                      <MapPin className="w-3.5 h-3.5 text-rose-600" />
                      <span>Buka Google Maps</span>
                      <ExternalLink className="w-3 h-3 ml-0.5 text-slate-400" />
                    </a>

                    <button
                      type="button"
                      onClick={() => setSelectedItem(item)}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition-colors min-h-[36px]"
                    >
                      Lihat Foto
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL LIGHTBOX FULLSCREEN FOTO BUKTI WATERMARK */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col border border-slate-700 shadow-2xl">
            {/* Header Modal */}
            <div className="p-3.5 border-b border-slate-800 flex items-center justify-between text-white">
              <div>
                <h3 className="font-bold text-sm">
                  Bukti Foto Presensi: {selectedItem.employee?.full_name}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {new Date(selectedItem.timestamp).toLocaleString('id-ID')} WIB
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Foto Container */}
            <div className="flex-1 overflow-auto p-2 bg-black flex items-center justify-center">
              {selectedItem.signed_photo_url ? (
                <img
                  src={selectedItem.signed_photo_url}
                  alt="Bukti Absensi Lengkap"
                  className="max-h-[70vh] w-auto object-contain rounded-lg shadow-lg"
                />
              ) : (
                <div className="text-slate-400 py-16">Foto tidak tersedia</div>
              )}
            </div>

            {/* Footer Modal Info */}
            <div className="p-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3 text-xs text-slate-300">
              <div className="truncate">
                <span className="font-semibold text-white">Lokasi: </span>
                <span>
                  {selectedItem.address_display || `${selectedItem.latitude}, ${selectedItem.longitude}`}
                </span>
              </div>
              <a
                href={`https://www.google.com/maps?q=${selectedItem.latitude},${selectedItem.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-1.5 flex-shrink-0 transition-colors"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Lihat di Maps</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
