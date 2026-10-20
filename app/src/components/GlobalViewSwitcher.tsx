import React from 'react';

interface GlobalViewSwitcherProps {
  currentView: 'home' | 'register' | 'patient' | 'staff' | 'analytics';
  onNavigate: (view: 'home' | 'register' | 'patient' | 'staff' | 'analytics') => void;
  onOpenScanner: () => void;
  patientToken?: string;
  isSyncing?: boolean;
}

export const GlobalViewSwitcher: React.FC<GlobalViewSwitcherProps> = ({
  currentView,
  onNavigate,
  onOpenScanner,
  patientToken,
  isSyncing,
}) => {
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
          Patient Live ({patientToken || 'MED-042'})
        </button>
        <button
          onClick={() => onNavigate('staff')}
          className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
            currentView === 'staff'
              ? 'bg-secondary text-white shadow-xs'
              : 'bg-primary-container text-primary-fixed hover:bg-white/10'
          }`}
        >
          Staff Workstation
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
          onClick={onOpenScanner}
          className="px-2 py-1 rounded text-xs font-semibold bg-primary-container text-secondary-fixed hover:bg-white/10 flex items-center gap-1"
          title="Open Gate Scanner Terminal"
        >
          <span className="material-symbols-outlined text-[14px]">qr_code_scanner</span>
          <span className="hidden sm:inline">Gate Scanner</span>
        </button>
      </div>
    </div>
  );
};
