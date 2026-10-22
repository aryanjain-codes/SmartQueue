import React, { useState } from 'react';
import { PatientQueueView, AnyQueueState } from '../types/queue';

interface PatientLiveViewProps {
  patientView: PatientQueueView;
  queueState: AnyQueueState | null;
  onRefresh: () => void;
  onNavigate: (view: 'home' | 'register' | 'patient' | 'staff' | 'analytics') => void;
  onOpenPass: () => void;
  onLookupToken: () => void;
}

export const PatientLiveView: React.FC<PatientLiveViewProps> = ({
  patientView,
  queueState,
  onRefresh,
  onNavigate,
  onOpenPass,
  onLookupToken,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [assistanceRequested, setAssistanceRequested] = useState(false);

  const handleManualRefresh = () => {
    setRefreshing(true);
    onRefresh();
    setTimeout(() => setRefreshing(false), 600);
  };

  const isServing = patientView.status === 'SERVING';
  const isCompleted = patientView.status === 'COMPLETED';

  // Suffix for ordinal position
  const getOrdinal = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const deptData = queueState?.departments?.[patientView.department];
  const nowServing = deptData?.nowServingToken || patientView.nowServingToken || 'Pending';

  return (
    <div className="max-w-md mx-auto min-h-screen bg-background flex flex-col relative pb-24 shadow-sm">
      {/* Top App Bar */}
      <header className="bg-surface-container-lowest sticky top-0 z-40 shadow-xs px-4 py-2.5 flex flex-col gap-1 border-b border-outline-variant/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center text-secondary-fixed">
              <span className="material-symbols-outlined text-[20px]">local_hospital</span>
            </div>
            <div>
              <h1 className="font-bold text-base text-primary tracking-tight">SmartQueue Live</h1>
              <span className="text-[10px] text-on-surface-variant font-mono">St. Jude Memorial Hospital</span>
            </div>
          </div>
          {/* Avatar & Lookup switcher */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onLookupToken}
              className="px-2 py-1 bg-surface-container hover:bg-surface-container-high rounded text-xs font-mono text-primary font-semibold flex items-center gap-1 transition-colors"
              title="Look up another Token"
            >
              <span className="material-symbols-outlined text-[15px]">search</span>
              <span>Switch</span>
            </button>
            <div className="w-8 h-8 rounded-full bg-primary-container text-white flex items-center justify-center font-bold text-xs border border-outline-variant">
              {patientView.fullName
                .split(' ')
                .map((n) => n[0])
                .join('')}
            </div>
          </div>
        </div>

        {/* Live Sync Status Bar */}
        <div className="flex items-center justify-between text-on-surface-variant pt-1.5 border-t border-outline-variant/30 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary"></span>
            </span>
            <span className="font-mono text-[10px] text-secondary uppercase tracking-wider font-semibold">
              Live System Connected
            </span>
          </div>
          <button
            onClick={handleManualRefresh}
            className="flex items-center gap-1 text-[11px] text-on-surface-variant hover:text-primary transition-colors cursor-pointer group"
          >
            <span
              className={`material-symbols-outlined text-[14px] transition-transform duration-500 ${
                refreshing ? 'rotate-180 text-secondary' : 'group-hover:rotate-180'
              }`}
            >
              refresh
            </span>
            <span>{refreshing ? 'Syncing...' : 'Updated Live'}</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="px-4 pt-3 flex flex-col gap-3.5">
        {/* Patient ID & Status summary banner */}
        <section className="bg-surface-container-lowest rounded-lg border border-outline-variant p-2.5 flex items-center justify-between shadow-xs">
          <div className="flex flex-col">
            <span className="font-semibold text-xs text-primary">
              {patientView.fullName} ({patientView.age}, {patientView.gender.charAt(0)})
            </span>
            <div className="flex items-center gap-1 text-[11px] font-mono">
              <span className="text-outline">Patient ID:</span>
              <span className="text-primary font-semibold">{patientView.id}</span>
            </div>
          </div>
          <div className="bg-surface-container-low px-2 py-0.5 rounded border border-outline-variant/60 flex items-center gap-1 text-[11px]">
            <span className="material-symbols-outlined text-secondary text-[15px]">verified_user</span>
            <span className="text-secondary font-semibold font-mono">Triage Cleared</span>
          </div>
        </section>

        {/* Hero Token Card */}
        <section className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden shadow-xs flex flex-col">
          {/* Navy Gradient Banner Header */}
          <div
            className={`p-4 text-white flex flex-col gap-1 transition-all ${
              isServing
                ? 'bg-gradient-to-r from-emerald-900 to-teal-800'
                : isCompleted
                ? 'bg-gradient-to-r from-slate-800 to-slate-900'
                : 'bg-gradient-to-r from-primary to-primary-container'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-primary-fixed uppercase tracking-wider font-mono font-medium">
                Your OPD Assigned Token
              </span>
              <div
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border ${
                  isServing
                    ? 'bg-emerald-400/20 text-emerald-200 border-emerald-300/40'
                    : isCompleted
                    ? 'bg-slate-400/20 text-slate-200 border-slate-300/40'
                    : 'bg-secondary-container/20 text-secondary-fixed border-secondary-fixed/30'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isServing ? 'bg-emerald-300 animate-ping' : isCompleted ? 'bg-slate-400' : 'bg-secondary-fixed animate-pulse'
                  }`}
                ></span>
                <span>
                  {isServing ? 'Now in Consultation' : isCompleted ? 'Consultation Completed' : 'In Waiting Queue'}
                </span>
              </div>
            </div>

            <div className="py-1 flex items-baseline justify-between">
              <span className="font-mono text-4xl sm:text-5xl font-bold tracking-tight text-white">
                {patientView.token}
              </span>
              <span className="text-xs text-primary-fixed-dim font-mono">Floor 2 • West Wing</span>
            </div>
          </div>

          {/* Token Department & Physician metadata */}
          <div className="p-3.5 flex flex-col gap-2.5 bg-surface-container-lowest">
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 rounded bg-surface-container text-primary shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[18px]">domain</span>
              </div>
              <div>
                <div className="text-[10px] text-on-surface-variant uppercase font-mono">Department & Room</div>
                <div className="text-sm font-bold text-primary">{patientView.department}</div>
                <div className="text-xs text-secondary font-semibold">Consultation {patientView.room}</div>
              </div>
            </div>
            <div className="h-px bg-outline-variant/40 my-0.5"></div>
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 rounded bg-surface-container text-primary shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[18px]">stethoscope</span>
              </div>
              <div>
                <div className="text-[10px] text-on-surface-variant uppercase font-mono">Attending Physician</div>
                <div className="text-sm font-bold text-primary">{patientView.doctor}</div>
                <div className="text-xs text-on-surface-variant">Consultant Clinical Lead</div>
              </div>
            </div>
          </div>
        </section>

        {/* Real-time Queue Telemetry Grid */}
        <section className="grid grid-cols-3 gap-2">
          {/* 1: Position */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 flex flex-col justify-between shadow-xs">
            <span className="text-[10px] text-on-surface-variant font-medium">Your Position</span>
            <div className="my-1">
              <span className="text-lg font-bold text-secondary font-mono block">
                {isServing ? 'NOW!' : isCompleted ? 'Done' : patientView.position ? getOrdinal(patientView.position) : 'Up Next'}
              </span>
              <span className="text-[10px] text-on-surface-variant">
                {isServing ? 'In Room' : isCompleted ? 'Discharged' : 'in line'}
              </span>
            </div>
            <span className="text-[9px] text-outline font-mono truncate">
              {patientView.triageSeverity}
            </span>
          </div>

          {/* 2: Now Serving */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 flex flex-col justify-between shadow-xs">
            <span className="text-[10px] text-on-surface-variant font-medium">Now Serving</span>
            <div className="my-1">
              <span className="font-mono text-base font-bold text-primary block truncate">
                {nowServing}
              </span>
              <span className="text-[10px] text-secondary font-semibold">In {patientView.room}</span>
            </div>
            <span className="text-[9px] text-outline font-mono truncate">
              {isServing
                ? 'Your turn!'
                : patientView.totalAhead === 0
                ? 'You are next'
                : `${patientView.totalAhead} patient(s) ahead`}
            </span>
          </div>

          {/* 3: Estimated Wait */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-on-surface-variant font-medium">Est. Wait</span>
              <span className="bg-secondary-container/40 text-on-secondary-container text-[8px] font-bold px-1 rounded uppercase">
                AI
              </span>
            </div>
            <div className="my-1">
              <span className="text-base font-bold text-primary font-mono block">
                {isServing ? 'Active' : isCompleted ? '0 min' : `~${patientView.estimatedWaitMinutes} mins`}
              </span>
              <span className="text-[10px] text-outline font-mono">
                {isServing ? 'In progress' : isCompleted ? 'Completed' : 'Dynamic Calc'}
              </span>
            </div>
            <span className="text-[8px] text-outline-variant truncate">SmartQueue ML</span>
          </div>
        </section>

        {/* Live Visit Workflow Tracker */}
        <section className="bg-surface-container-lowest rounded-xl border border-outline-variant p-3.5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-primary">Live Visit Workflow</h2>
            <span className="text-[10px] text-secondary font-semibold font-mono">
              {isCompleted ? 'All Steps Finished' : isServing ? 'Step 4 of 4 Active' : 'Step 2 of 4 Active'}
            </span>
          </div>

          <div className="relative pl-5 space-y-4 before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-[2px] before:bg-outline-variant/60">
            {/* Step 1: Verified */}
            <div className="relative">
              <div className="absolute -left-5 top-0.5 w-[20px] h-[20px] rounded-full bg-secondary flex items-center justify-center text-white ring-4 ring-white">
                <span className="material-symbols-outlined text-[13px]">check</span>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-primary">OPD Check-in Verified</span>
                  <span className="text-[10px] font-mono text-on-surface-variant">Validated</span>
                </div>
                <p className="text-[11px] text-on-surface-variant">Digital triage profile generated & token registered.</p>
              </div>
            </div>

            {/* Step 2: Waiting outside room */}
            <div className="relative">
              <div
                className={`absolute -left-5 top-0.5 w-[20px] h-[20px] rounded-full flex items-center justify-center ring-4 ring-white ${
                  isServing || isCompleted
                    ? 'bg-secondary text-white'
                    : 'bg-primary-container border-2 border-secondary text-secondary-fixed'
                }`}
              >
                {isServing || isCompleted ? (
                  <span className="material-symbols-outlined text-[13px]">check</span>
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-ping"></span>
                )}
              </div>
              <div className="bg-surface-container-low p-2 rounded border border-secondary/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-primary flex items-center gap-1">
                    Waiting Outside {patientView.room}
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary inline-block"></span>
                  </span>
                  <span className="text-[9px] text-secondary font-bold font-mono">
                    {isServing || isCompleted ? 'PASSED' : 'CURRENT'}
                  </span>
                </div>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Please stay seated within hearing range of the clinical call audio chime.
                </p>
              </div>
            </div>

            {/* Step 3: Vitals check */}
            <div className={`relative ${!isServing && !isCompleted ? 'opacity-70' : ''}`}>
              <div
                className={`absolute -left-5 top-0.5 w-[20px] h-[20px] rounded-full flex items-center justify-center ring-4 ring-white ${
                  isServing || isCompleted ? 'bg-secondary text-white' : 'bg-surface-container border border-outline-variant text-outline'
                }`}
              >
                {isServing || isCompleted ? (
                  <span className="material-symbols-outlined text-[13px]">check</span>
                ) : (
                  <span className="material-symbols-outlined text-[12px]">vital_signs</span>
                )}
              </div>
              <div>
                <span className="text-xs font-semibold text-primary">Vitals Check by Triage Nurse</span>
                <p className="text-[11px] text-on-surface-variant">Blood pressure, oxygen saturation, and body temperature.</p>
              </div>
            </div>

            {/* Step 4: Doctor Consultation */}
            <div className={`relative ${!isServing && !isCompleted ? 'opacity-70' : ''}`}>
              <div
                className={`absolute -left-5 top-0.5 w-[20px] h-[20px] rounded-full flex items-center justify-center ring-4 ring-white ${
                  isServing
                    ? 'bg-emerald-600 text-white animate-pulse'
                    : isCompleted
                    ? 'bg-secondary text-white'
                    : 'bg-surface-container border border-outline-variant text-outline'
                }`}
              >
                <span className="material-symbols-outlined text-[12px]">stethoscope</span>
              </div>
              <div>
                <span className="text-xs font-semibold text-primary">
                  {isServing ? 'Now in Consultation with Doctor!' : 'Doctor Consultation'}
                </span>
                <p className="text-[11px] text-on-surface-variant">
                  {patientView.doctor} • {patientView.room}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Lounge Instruction Notice */}
        <section className="bg-surface-container-low border border-outline-variant rounded-xl p-3 flex gap-2.5 items-start">
          <div className="p-1.5 rounded-lg bg-surface-container-highest text-secondary shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-[18px]">campaign</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-bold text-primary">Lounge Instruction</span>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Please remain within <strong className="text-primary font-semibold">Zone B waiting lounge</strong>. You will receive an SMS and audio call chime when Token <span className="font-mono font-bold text-primary">{patientView.token}</span> is called.
            </p>
          </div>
        </section>

        {/* Quick Action Buttons */}
        <section className="space-y-2">
          <button
            onClick={onOpenPass}
            className="w-full bg-white border-2 border-secondary text-secondary hover:bg-secondary-container/20 active:scale-95 transition-all rounded-lg py-2.5 px-3 flex items-center justify-center gap-2 font-bold shadow-xs text-xs"
          >
            <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
            <span>View 30-Day Digital QR Pass</span>
          </button>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => {
                setAssistanceRequested(true);
                setTimeout(() => setAssistanceRequested(false), 4000);
              }}
              className={`border border-outline-variant active:scale-95 transition-all py-2 px-2 rounded-lg flex items-center justify-center gap-1 font-medium text-center ${
                assistanceRequested
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-white hover:bg-surface-container text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px] text-primary">
                {assistanceRequested ? 'check_circle' : 'accessible'}
              </span>
              <span>{assistanceRequested ? 'Nurse Summoned ✓' : 'Request Assistance'}</span>
            </button>
            <button
              onClick={onLookupToken}
              className="bg-white border border-outline-variant hover:bg-surface-container active:scale-95 transition-all text-on-surface py-2 px-2 rounded-lg flex items-center justify-center gap-1 font-medium text-center"
            >
              <span className="material-symbols-outlined text-[16px] text-primary">manage_search</span>
              <span>Look Up Token</span>
            </button>
          </div>
        </section>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 w-full z-40 flex justify-around items-center px-2 py-1.5 pb-safe bg-surface-container-lowest shadow-sm max-w-md left-1/2 -translate-x-1/2 border-t border-outline-variant/40">
        <button
          onClick={() => onNavigate('home')}
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary px-3 py-1 transition-colors"
        >
          <span className="material-symbols-outlined text-xl">home</span>
          <span className="text-[10px] mt-0.5">Home</span>
        </button>
        <button
          onClick={() => onNavigate('patient')}
          className="flex flex-col items-center justify-center text-secondary bg-secondary-container/20 rounded-lg px-3 py-1 font-semibold"
        >
          <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            queue
          </span>
          <span className="text-[10px] mt-0.5">Live Queue</span>
        </button>
        <button
          onClick={() => onNavigate('register')}
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary px-3 py-1 transition-colors"
        >
          <span className="material-symbols-outlined text-xl">assignment</span>
          <span className="text-[10px] mt-0.5">Check-In</span>
        </button>
        <button
          onClick={() => onNavigate('staff')}
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary px-3 py-1 transition-colors"
        >
          <span className="material-symbols-outlined text-xl">badge</span>
          <span className="text-[10px] mt-0.5">Staff</span>
        </button>
      </nav>
    </div>
  );
};
