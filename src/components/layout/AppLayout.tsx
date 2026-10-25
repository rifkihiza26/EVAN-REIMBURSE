import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Receipt,
  PlusCircle,
  FileCheck2,
  Wallet,
  FileBarChart,
  Users,
  LogOut,
  Tag,
} from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const isBoss = profile?.role === 'boss';

  const handleLogout = async () => {
    if (window.confirm('Apakah Anda yakin ingin keluar dari aplikasi?')) {
      await signOut();
      navigate('/login');
    }
  };

  // Nav items definition
  const employeeNavItems = [
    { to: '/employee/dashboard', label: 'Beranda', icon: LayoutDashboard },
    { to: '/employee/reimbursements', label: 'Riwayat', icon: Receipt },
    { to: '/employee/reimbursements/new', label: 'Ajukan', icon: PlusCircle, highlight: true },
  ];

  const bossNavItems = [
    { to: '/boss/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/boss/approvals', label: 'Persetujuan', icon: FileCheck2 },
    { to: '/boss/payments', label: 'Pembayaran', icon: Wallet },
    { to: '/boss/reports', label: 'Laporan', icon: FileBarChart },
    { to: '/boss/reimbursements', label: 'Semua Klaim', icon: Receipt },
    { to: '/boss/employees', label: 'Karyawan', icon: Users },
    { to: '/boss/categories', label: 'Kategori', icon: Tag },
  ];

  const mobileNavItems = isBoss
    ? [
        { to: '/boss/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/boss/approvals', label: 'Persetujuan', icon: FileCheck2 },
        { to: '/boss/payments', label: 'Bayar', icon: Wallet },
        { to: '/boss/reports', label: 'Laporan', icon: FileBarChart },
        { to: '/boss/reimbursements', label: 'Semua', icon: Receipt },
      ]
    : employeeNavItems;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex md:w-64 bg-slate-900 text-slate-200 flex-col flex-shrink-0 min-h-screen sticky top-0 shadow-lg">
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center p-1 overflow-hidden shadow-sm flex-shrink-0">
            <img src="/logo.jpg" alt="Logo Rambat Ruang Optima" className="w-full h-full object-contain" />
          </div>
          <div className="overflow-hidden">
            <h1 className="font-extrabold text-white text-xs leading-tight tracking-tight uppercase">RAMBAT RUANG OPTIMA</h1>
            <p className="text-[11px] text-emerald-400 font-medium">
              {isBoss ? 'Portal Pimpinan (Bos)' : 'Portal Pegawai'}
            </p>
          </div>
        </div>

        {/* User Card */}
        <div className="p-4 mx-3 my-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
          <div className="text-sm font-semibold text-white truncate">{profile?.full_name}</div>
          <div className="text-xs text-slate-400 truncate">{profile?.email}</div>
          <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-emerald-900/60 text-emerald-300 border border-emerald-700/40">
            {profile?.role === 'boss' ? 'Bos (Approver)' : 'Employee'}
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {(isBoss ? bossNavItems : employeeNavItems).map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Logout Action */}
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition-colors"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* MOBILE HEADER */}
      <header className="md:hidden bg-slate-900 text-white px-4 py-2.5 sticky top-0 z-30 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white p-0.5 flex items-center justify-center overflow-hidden flex-shrink-0">
            <img src="/logo.jpg" alt="Logo Rambat Ruang Optima" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="font-extrabold text-xs tracking-tight uppercase">RAMBAT RUANG OPTIMA</h1>
            <p className="text-[10px] text-slate-400">
              {profile?.full_name} • <span className="uppercase text-emerald-400">{profile?.role}</span>
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          title="Keluar"
          className="p-2 text-slate-300 hover:text-rose-400 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 pb-24 md:pb-8 pt-4 md:pt-6 px-4 md:px-8 max-w-7xl mx-auto w-full">
        {children}
      </main>

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 px-2 py-1.5 flex items-center justify-around shadow-xl">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-w-[48px] min-h-[48px] py-1 px-2 rounded-lg text-[11px] font-medium transition-colors ${
                  item.highlight
                    ? 'text-emerald-700 font-bold'
                    : isActive
                    ? 'text-emerald-600 font-semibold'
                    : 'text-slate-500 hover:text-slate-900'
                }`
              }
            >
              <Icon className={`w-5 h-5 mb-0.5 ${item.highlight ? 'text-emerald-600' : ''}`} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};
