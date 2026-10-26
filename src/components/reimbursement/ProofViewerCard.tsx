import React, { useState } from 'react';
import { ReimbursementFile } from '../../types';
import { Maximize2, X, Download, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatFileSize } from '../../lib/formatters';

interface ProofViewerCardProps {
  files: ReimbursementFile[];
  title?: string;
}

export const ProofViewerCard: React.FC<ProofViewerCardProps> = ({
  files,
  title = 'Bukti Fisik Transaksi (Nota / Struk)',
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  if (!files || files.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 mb-2">{title}</h3>
        <p className="text-xs text-slate-400 italic">Tidak ada berkas bukti terlampir.</p>
      </div>
    );
  }

  const currentFile = files[selectedIndex] || files[0];
  const isImage = currentFile.mime_type.startsWith('image/');
  const isPdf = currentFile.mime_type === 'application/pdf';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6 shadow-xs space-y-4">
      {/* Header Card */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          {files.length > 1 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {selectedIndex + 1} / {files.length}
            </span>
          )}
        </div>

        {currentFile.signed_url && (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Perbesar Nota</span>
          </button>
        )}
      </div>

      {/* Main Preview Container */}
      <div className="relative rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center min-h-[360px] max-h-[560px] border border-slate-800 group">
        {isImage && currentFile.signed_url ? (
          <img
            src={currentFile.signed_url}
            alt={currentFile.original_filename}
            className="w-full h-full max-h-[540px] object-contain cursor-pointer transition-transform duration-200 hover:scale-[1.01]"
            onClick={() => setIsModalOpen(true)}
          />
        ) : isPdf && currentFile.signed_url ? (
          <iframe
            src={`${currentFile.signed_url}#toolbar=0`}
            title={currentFile.original_filename}
            className="w-full h-[500px] border-none bg-white"
          />
        ) : (
          <div className="text-center p-8 text-slate-400">
            <FileText className="w-12 h-12 mx-auto mb-2 text-slate-500" />
            <p className="text-sm font-medium">{currentFile.original_filename}</p>
            <p className="text-xs text-slate-500 mt-1">
              Preview tidak didukung langsung. Silakan unduh berkas.
            </p>
          </div>
        )}

        {/* Previous & Next Buttons for Multi-files */}
        {files.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setSelectedIndex((prev) => (prev > 0 ? prev - 1 : files.length - 1))}
              className="absolute left-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center backdrop-blur-xs"
              title="Bukti Sebelumnya"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setSelectedIndex((prev) => (prev < files.length - 1 ? prev + 1 : 0))}
              className="absolute right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center backdrop-blur-xs"
              title="Bukti Berikutnya"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {/* File Info Bar / Thumbnail List */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-xs text-slate-600">
        <div className="truncate">
          <span className="font-semibold text-slate-800">{currentFile.original_filename}</span>
          <span className="text-slate-400 ml-2">
            ({formatFileSize(currentFile.file_size)} • {currentFile.mime_type.split('/')[1]?.toUpperCase()})
          </span>
        </div>

        {currentFile.signed_url && (
          <a
            href={currentFile.signed_url}
            download={currentFile.original_filename}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-blue-700 hover:text-blue-900 font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Unduh Berkas Asli</span>
          </a>
        )}
      </div>

      {/* Multi-Files Thumbnails */}
      {files.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pt-2 pb-1">
          {files.map((f, idx) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setSelectedIndex(idx)}
              className={`p-1.5 rounded-lg border text-left text-xs flex items-center gap-2 transition-all flex-shrink-0 ${
                selectedIndex === idx
                  ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20 font-bold text-blue-900'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
              }`}
            >
              <span className="w-5 h-5 rounded-md bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold">
                {idx + 1}
              </span>
              <span className="truncate max-w-[130px]">{f.original_filename}</span>
            </button>
          ))}
        </div>
      )}

      {/* LIGHTBOX / FULLSCREEN MODAL (POPUP PERBESAR NOTA) */}
      {isModalOpen && currentFile.signed_url && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col p-4 sm:p-6 animate-fade-in">
          {/* Modal Header */}
          <div className="flex items-center justify-between text-white pb-3 border-b border-white/10">
            <div className="truncate">
              <h4 className="text-sm font-bold truncate">{currentFile.original_filename}</h4>
              <p className="text-xs text-white/60">
                {files.length > 1 && `Bukti ${selectedIndex + 1} dari ${files.length} • `}
                {formatFileSize(currentFile.file_size)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <a
                href={currentFile.signed_url}
                target="_blank"
                rel="noreferrer"
                download={currentFile.original_filename}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="Unduh Berkas"
              >
                <Download className="w-5 h-5" />
              </a>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-lg bg-white/10 hover:bg-rose-600 text-white transition-colors"
                title="Tutup (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Content */}
          <div className="flex-1 flex items-center justify-center p-2 overflow-auto relative">
            {isImage ? (
              <img
                src={currentFile.signed_url}
                alt={currentFile.original_filename}
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              />
            ) : isPdf ? (
              <iframe
                src={currentFile.signed_url}
                title={currentFile.original_filename}
                className="w-full h-[85vh] border-none rounded-lg bg-white"
              />
            ) : (
              <div className="text-white text-center">
                <FileText className="w-16 h-16 mx-auto mb-2 text-white/60" />
                <p>Preview tidak didukung. Silakan gunakan tombol unduh di kanan atas.</p>
              </div>
            )}

            {/* Modal Next / Prev controls */}
            {files.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedIndex((prev) => (prev > 0 ? prev - 1 : files.length - 1))}
                  className="absolute left-2 sm:left-4 p-3 rounded-full bg-white/10 hover:bg-white/30 text-white transition-colors backdrop-blur-xs"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIndex((prev) => (prev < files.length - 1 ? prev + 1 : 0))}
                  className="absolute right-2 sm:right-4 p-3 rounded-full bg-white/10 hover:bg-white/30 text-white transition-colors backdrop-blur-xs"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
