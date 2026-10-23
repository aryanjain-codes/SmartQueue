import React from 'react';

interface GlobalViewSwitcherProps {
  currentView: 'home' | 'register' | 'patient' | 'staff' | 'analytics';
  staffRole?: 'clinical' | 'security';
  onNavigate: (view: 'home' | 'register' | 'patient' | 'staff' | 'analytics') => void;
  onSelectStaffRole?: (role: 'clinical' | 'security') => void;
  onOpenScanner: () => void;
  patientToken?: string;
  isSyncing?: boolean;
}

export const GlobalViewSwitcher: React.FC<GlobalViewSwitcherProps> = ({
  currentView,
  staffRole = 'clinical',
  onNavigate,
  onSelectStaffRole,
  onOpenScanner,
  patientToken,
  isSyncing,
}) => {
  const handleSelectStaff = (role: 'clinical' | 'security') => {
    if (onSelectStaffRole) onSelectStaffRole(role);
    onNavigate('staff');
  };

  return (
    <div className="bg-primary text-white text-xs px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 border-b border-primary-container shadow-xs z-50">
      {/* Brand & Sync indicator */}
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-secondary-fixed animate-pulse"></span>
        <span className="font-bold tracking-tight text-white flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px] text-secondary-fixed">local_hospital</span>
          SmartQueue OPD
        </span>
        <span className="text-[10px] font-mono text-primary-fixed-dim hidden sm:inline-block">
          {isSyncing ? '• Syncing live...' : '• Connected to persistent DB'}
        </span>
      </div>

      {/* View Switcher Chips */}
      <div className="flex items-center gap-1 overflow-x-auto py-0.5">
        <span className="text-[10px] uppercase font-mono text-primary-fixed-dim mr-1 hidden md:inline">
          View Mode:
        </span>
        <button
          onClick={() => onNavigate('home')}
          className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
            currentView === 'home'
              ? 'bg-secondary text-white shadow-xs'
              : 'bg-primary-container text-primary-fixed hover:bg-white/10'
          }`}
        >
          Landing
        </button>
        <button
          onClick={() => onNavigate('register')}
          className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
            currentView === 'register'
              ? 'bg-secondary text-white shadow-xs'
              : 'bg-primary-container text-primary-fixed hover:bg-white/10'
          }`}
        >
          Patient Registration
        </button>
        <button
          onClick={() => onNavigate('patient')}
          className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
            currentView === 'patient'
              ? 'bg-secondary text-white shadow-xs'
              : 'bg-primary-container text-primary-fixed hover:bg-white/10'
          }`}
        >
          {patientToken ? `Patient Live (${patientToken})` : 'Patient Live View'}
        </button>
        {/* Clinical Staff */}
        <button
          onClick={() => handleSelectStaff('clinical')}
          className={`px-2.5 py-1 rounded text-xs font-semibold transition-all flex items-center gap-1 ${
            currentView === 'staff' && staffRole === 'clinical'
              ? 'bg-secondary text-white shadow-xs'
              : 'bg-primary-container text-primary-fixed hover:bg-white/10'
          }`}
          title="Clinical Staff Workstation (Physician EHR & Call Next)"
        >
          <span className="material-symbols-outlined text-[13px]">stethoscope</span>
          <span>Doctor Workstation</span>
        </button>
        {/* Security Staff */}
        <button
          onClick={() => handleSelectStaff('security')}
          className={`px-2.5 py-1 rounded text-xs font-semibold transition-all flex items-center gap-1 ${
            currentView === 'staff' && staffRole === 'security'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-primary-container text-primary-fixed hover:bg-white/10'
          }`}
          title="Security Gate Terminal (Pass Validator & Least-Privilege Logs)"
        >
          <span className="material-symbols-outlined text-[13px]">shield</span>
          <span>Gate Security</span>
        </button>
        <button
          onClick={() => onNavigate('analytics')}
          className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
            currentView === 'analytics'
              ? 'bg-secondary text-white shadow-xs'
              : 'bg-primary-container text-primary-fixed hover:bg-white/10'
          }`}
        >
          Analytics
        </button>
        <button
          type="button"
          onClick={onOpenScanner}
          className="px-2.5 py-1 rounded text-xs font-semibold bg-secondary-fixed text-primary hover:bg-secondary-fixed-dim transition-all flex items-center gap-1 shadow-xs cursor-pointer"
          title="Open Gate Scanner Terminal Modal"
        >
          <span className="material-symbols-outlined text-[15px]">qr_code_scanner</span>
          <span className="font-bold">Gate Scanner</span>
        </button>
      </div>
    </div>
  );
};
