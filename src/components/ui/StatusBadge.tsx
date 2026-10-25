import React from 'react';
import { ApprovalStatus, PaymentStatus } from '../../types';

interface StatusBadgeProps {
  type: 'approval' | 'payment';
  status: ApprovalStatus | PaymentStatus;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ type, status, className = '' }) => {
  if (type === 'approval') {
    switch (status) {
      case 'draft':
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-300 ${className}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
            Draft
          </span>
        );
      case 'pending':
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-300 ${className}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            Menunggu Persetujuan
          </span>
        );
      case 'revision':
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-800 border border-blue-300 ${className}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            Perlu Revisi
          </span>
        );
      case 'approved':
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-300 ${className}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Disetujui
          </span>
        );
      case 'rejected':
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-800 border border-rose-300 ${className}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Ditolak
          </span>
        );
      case 'cancelled':
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-300 ${className}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
            Dibatalkan
          </span>
        );
    }
  }

  // Payment status badges
  if (status === 'paid') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-300 ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
        Sudah Dibayar
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-300 ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
      Belum Dibayar
    </span>
  );
};
