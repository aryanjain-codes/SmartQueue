import React, { useState } from 'react';
import { PatientQueueView, AnyQueueState } from '../types/queue';
import { SmartQueueAssistant } from './SmartQueueAssistant';

interface PatientLiveViewProps {
  patientView: PatientQueueView;
  queueState: AnyQueueState | null;
  successMessage?: string | null;
  onDismissSuccess?: () => void;
  onRefresh: () => void;
  onNavigate: (view: 'home' | 'register' | 'patient' | 'staff' | 'analytics') => void;
  onOpenPass: () => void;
  onLookupToken: () => void;
  onOpenScanner?: () => void;
}

export const PatientLiveView: React.FC<PatientLiveViewProps> = ({
  patientView,
  queueState,
  successMessage,
  onDismissSuccess,
  onRefresh,
  onNavigate,
  onOpenPass,
  onLookupToken,
  onOpenScanner,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [assistanceRequested, setAssistanceRequested] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);

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
    <div className="w-full max-w-md md:max-w-4xl lg:max-w-5xl mx-auto min-h-screen bg-surface-container-lowest flex flex-col relative pb-20 md:pb-8 shadow-sm">
      {/* Top App Bar */}
      <header className="bg-surface-container-lowest sticky top-0 z-40 shadow-xs px-4 md:px-6 py-2.5 flex flex-col gap-1 border-b border-outline-variant/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onNavigate('home')}
              className="w-9 h-9 rounded-xl bg-primary-container flex items-center justify-center text-secondary-fixed shadow-xs hover:scale-105 transition-transform cursor-pointer"
              title="Return to Home Landing"
            >
              <span className="material-symbols-outlined text-[20px]">local_hospital</span>
            </button>
            <div>
              <h1 className="font-bold text-base text-primary tracking-tight">SmartQueue Live</h1>
              <span className="text-[10px] text-on-surface-variant font-mono">St. Jude Memorial Hospital</span>
            </div>
          </div>

          {/* Avatar, Assistant & Lookup switcher */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setAssistantOpen(true)}
              className="px-2.5 py-1 bg-secondary text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs hover:bg-secondary/90 transition-all cursor-pointer active:scale-95"
              title="Open SmartQueue Assistant"
            >
              <span className="material-symbols-outlined text-[15px]">smart_toy</span>
              <span>Ask AI</span>
            </button>
            <button
              onClick={onLookupToken}
              className="px-2.5 py-1 bg-surface-container hover:bg-surface-container-high rounded-lg text-xs font-mono text-primary font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              title="Look up another Token"
            >
              <span className="material-symbols-outlined text-[15px]">search</span>
              <span>Switch</span>
            </button>
            <button
              onClick={() => onNavigate('home')}
              className="hidden md:inline-flex px-2 py-1 text-xs text-on-surface-variant hover:text-primary transition-colors font-medium"
            >
              Home
            </button>
            <div className="w-8 h-8 rounded-full bg-primary-container text-white flex items-center justify-center font-bold text-xs border border-outline-variant shrink-0">
              {(patientView.fullName || 'Patient')
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2) || 'PT'}
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
              Live System Connected • Dynamic ETA Engine Active
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
            <span>
              {refreshing
                ? 'Syncing...'
                : `Updated ${
                    patientView.lastUpdated
                      ? new Date(patientView.lastUpdated).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })
                      : 'Live'
                  }`}
            </span>
          </button>
        </div>
      </header>

      {/* Main Content Area (Responsive Grid on Tablet/Desktop) */}
      <main className="px-4 md:px-6 pt-3 md:pt-5 flex-1">
        {/* Registration Success Notification Banner */}
        {successMessage && (
          <div className="mb-4 bg-emerald-50 border-2 border-emerald-500 rounded-xl p-3 flex items-start justify-between shadow-xs animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-start gap-2.5">
              <span className="material-symbols-outlined text-emerald-600 text-xl shrink-0 mt-0.5">
                check_circle
              </span>
              <div>
                <h4 className="text-xs font-bold text-emerald-950">Registration Complete!</h4>
                <p className="text-[11px] text-emerald-800 leading-snug mt-0.5">{successMessage}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <button
                    onClick={onOpenPass}
                    className="px-2 py-0.5 bg-emerald-700 text-white rounded text-[10px] font-bold tracking-wide hover:bg-emerald-800 transition-colors shadow-xs"
                  >
                    View QR Pass Now
                  </button>
                </div>
              </div>
            </div>
            {onDismissSuccess && (
              <button
                onClick={onDismissSuccess}
                className="text-emerald-700 hover:text-emerald-950 p-0.5 rounded transition-colors"
                title="Dismiss"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </div>
        )}

        <div className="md:grid md:grid-cols-12 md:gap-6 md:items-start space-y-3.5 md:space-y-0">
          {/* Left Column: Hero Token Card & Live Telemetry */}
          <div className="md:col-span-7 flex flex-col gap-3.5">
            {/* Patient ID & Status summary banner */}
            <section className="bg-surface-container-lowest rounded-xl border border-outline-variant p-3 flex items-center justify-between shadow-xs">
              <div className="flex flex-col">
                <span className="font-bold text-sm text-primary">
                  {patientView.fullName || 'Patient'} ({patientView.age ?? '—'}, {patientView.gender ? patientView.gender.charAt(0) : 'U'})
                </span>
                <div className="flex items-center gap-1.5 text-xs font-mono mt-0.5">
                  <span className="text-outline">Patient ID:</span>
                  <span className="text-primary font-semibold">{patientView.id}</span>
                </div>
              </div>
              <div className="bg-surface-container-low px-2.5 py-1 rounded-full border border-outline-variant/60 flex items-center gap-1.5 text-xs shadow-2xs">
                <span className="material-symbols-outlined text-secondary text-[16px]">verified_user</span>
                <span className="text-secondary font-bold font-mono">Triage Cleared</span>
              </div>
            </section>

            {/* Hero Token Card */}
            <section className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden shadow-xs flex flex-col interactive-card">
              {/* Header Gradient */}
              <div
                className={`p-4 md:p-5 text-white flex flex-col gap-1.5 transition-all ${
                  isServing
                    ? 'bg-gradient-to-r from-emerald-900 to-teal-800'
                    : isCompleted
                    ? 'bg-gradient-to-r from-slate-800 to-slate-900'
                    : 'bg-gradient-to-r from-primary to-primary-container'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-primary-fixed uppercase tracking-wider font-mono font-bold">
                    Your OPD Assigned Token
                  </span>
                  <div
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                      isServing
                        ? 'bg-emerald-400/20 text-emerald-200 border-emerald-300/40'
                        : isCompleted
                        ? 'bg-slate-400/20 text-slate-200 border-slate-300/40'
                        : 'bg-secondary-container/20 text-secondary-fixed border-secondary-fixed/30'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isServing ? 'bg-emerald-300 animate-ping' : isCompleted ? 'bg-slate-400' : 'bg-secondary-fixed animate-pulse'
                      }`}
                    ></span>
                    <span>
                      {isServing ? 'Now in Consultation' : isCompleted ? 'Consultation Completed' : 'In Waiting Queue'}
                    </span>
                  </div>
                </div>

                <div className="py-2 flex items-baseline justify-between">
                  <span className="font-mono text-5xl sm:text-6xl font-extrabold tracking-tight text-white drop-shadow-xs">
                    {patientView.token}
                  </span>
                  <span className="text-xs sm:text-sm text-primary-fixed-dim font-mono font-medium">Floor 2 • West Wing</span>
                </div>
              </div>

              {/* Token Department & Physician metadata */}
              <div className="p-4 flex flex-col gap-3 bg-surface-container-lowest">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-surface-container text-primary shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[20px]">domain</span>
                  </div>
                  <div>
                    <div className="text-[10px] text-on-surface-variant uppercase font-mono font-semibold">Department & Room</div>
                    <div className="text-base font-bold text-primary">{patientView.department}</div>
                    <div className="text-xs text-secondary font-semibold font-mono">Consultation {patientView.room}</div>
                  </div>
                </div>
                <div className="h-px bg-outline-variant/40"></div>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-surface-container text-primary shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[20px]">stethoscope</span>
                  </div>
                  <div>
                    <div className="text-[10px] text-on-surface-variant uppercase font-mono font-semibold">Attending Physician</div>
                    <div className="text-base font-bold text-primary">{patientView.doctor}</div>
                    <div className="text-xs text-on-surface-variant font-medium">Consultant Clinical Lead</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Real-time Queue Telemetry Grid */}
            <section className="grid grid-cols-3 gap-2.5">
              {/* 1: Position */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-3 flex flex-col justify-between shadow-xs interactive-card">
                <span className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wider">Your Position</span>
                <div className="my-1.5">
                  <span className="text-xl font-extrabold text-secondary font-mono block">
                    {isServing ? 'NOW!' : isCompleted ? 'Done' : patientView.position ? getOrdinal(patientView.position) : 'Up Next'}
                  </span>
                  <span className="text-[11px] text-on-surface-variant font-medium">
                    {isServing ? 'In Room' : isCompleted ? 'Discharged' : 'in line'}
                  </span>
                </div>
                <span className="text-[10px] text-outline font-mono truncate font-semibold">
                  {patientView.triageSeverity}
                </span>
              </div>

              {/* 2: Now Serving */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-3 flex flex-col justify-between shadow-xs interactive-card">
                <span className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wider">Now Serving</span>
                <div className="my-1.5">
                  <span className="font-mono text-xl font-extrabold text-primary block truncate">
                    {nowServing}
                  </span>
                  <span className="text-[11px] text-secondary font-semibold font-mono">In {patientView.room}</span>
                </div>
                <span className="text-[10px] text-outline font-mono truncate">
                  {isServing
                    ? 'Your turn!'
                    : patientView.totalAhead === 0
                    ? 'You are next'
                    : `${patientView.totalAhead} patient(s) ahead`}
                </span>
              </div>

              {/* 3: Estimated Wait */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-3 flex flex-col justify-between shadow-xs interactive-card">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wider">Est. Wait</span>
                  <span className="bg-secondary-container/40 text-on-secondary-container text-[9px] font-bold px-1.5 rounded-full font-mono uppercase">
                    Dynamic
                  </span>
                </div>
                <div className="my-1.5">
                  <span
                    className={`text-xl font-extrabold font-mono block ${
                      patientView.etaUnavailable ? 'text-amber-700 text-xs' : 'text-primary'
                    }`}
                  >
                    {patientView.etaUnavailable
                      ? 'Unavailable'
                      : isServing
                      ? 'Active'
                      : isCompleted
                      ? '0 min'
                      : patientView.estimatedWaitMinutes === 0
                      ? 'Next (~0m)'
                      : `~${patientView.estimatedWaitMinutes} mins`}
                  </span>
                  <span className="text-[10px] text-outline font-mono truncate block" title={patientView.etaReason}>
                    {patientView.etaUnavailable
                      ? patientView.etaReason || 'Doctor Offline'
                      : isServing
                      ? 'In progress'
                      : isCompleted
                      ? 'Completed'
                      : patientView.totalAhead === 0
                      ? 'Up next'
                      : `${patientView.totalAhead} ahead`}
                  </span>
                </div>
                <span className="text-[9px] text-outline-variant font-mono">Real-time ETA</span>
              </div>
            </section>

            {/* Live Visit Workflow Tracker */}
            <section className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold text-primary">Live Visit Workflow</h2>
                <span className="text-[10px] text-secondary font-semibold font-mono">
                  {isCompleted ? 'All Steps Finished' : isServing ? 'Step 3 of 3 Active' : 'Step 2 of 3 Active'}
                </span>
              </div>

              <div className="relative pl-5 space-y-4 before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-[2px] before:bg-outline-variant/60">
                {/* Step 1: Verified */}
                <div className="relative">
                  <div className="absolute -left-5 top-0.5 w-[20px] h-[20px] rounded-full bg-secondary flex items-center justify-center text-white ring-4 ring-white shadow-xs">
                    <span className="material-symbols-outlined text-[13px]">check</span>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-primary">OPD Check-in Verified</span>
                      <span className="text-[10px] font-mono text-secondary font-semibold">Validated</span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant">Digital triage profile generated & token registered.</p>
                  </div>
                </div>

                {/* Step 2: Waiting outside room */}
                <div className="relative">
                  <div
                    className={`absolute -left-5 top-0.5 w-[20px] h-[20px] rounded-full flex items-center justify-center ring-4 ring-white shadow-xs ${
                      isServing || isCompleted
                        ? 'bg-secondary text-white'
                        : 'bg-primary-container border-2 border-secondary text-secondary-fixed'
                    }`}
                  >
                    {isServing || isCompleted ? (
                      <span className="material-symbols-outlined text-[13px]">check</span>
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-primary">
                        {isServing || isCompleted ? 'Called from Lounge' : 'Waiting in Zone B Lounge'}
                      </span>
                      <span className="text-[10px] font-mono text-outline">
                        {isServing ? 'Called' : isCompleted ? 'Completed' : 'In Progress'}
                      </span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant">
                      {isServing
                        ? 'Physician called token into consulting room.'
                        : `Remain seated in Zone B. Dynamic ETA: ~${patientView.estimatedWaitMinutes ?? 'N/A'} mins.`}
                    </p>
                  </div>
                </div>

                {/* Step 3: Doctor Consultation */}
                <div className="relative">
                  <div
                    className={`absolute -left-5 top-0.5 w-[20px] h-[20px] rounded-full flex items-center justify-center ring-4 ring-white shadow-xs ${
                      isCompleted
                        ? 'bg-secondary text-white'
                        : isServing
                        ? 'bg-secondary text-white'
                        : 'bg-surface-container border border-outline-variant text-outline'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[12px]">stethoscope</span>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-primary">
                      {isServing ? 'Now in Consultation with Doctor!' : isCompleted ? 'Consultation Concluded' : 'Doctor Consultation'}
                    </span>
                    <p className="text-[11px] text-on-surface-variant">
                      {patientView.doctor} • {patientView.room}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Right Column: SmartQueue Assistant, Lounge & Pass Actions */}
          <div className="md:col-span-5 flex flex-col gap-3.5">
            {/* SmartQueue Assistant Card */}
            <section className="bg-gradient-to-r from-secondary-container/20 via-surface-container-low to-surface-container border border-secondary/30 rounded-2xl p-4 flex flex-col gap-3 shadow-xs interactive-card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary text-white flex items-center justify-center shrink-0 shadow-xs">
                  <span className="material-symbols-outlined text-[22px]">smart_toy</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary">SmartQueue Assistant</span>
                    <span className="px-2 py-0.5 rounded-full bg-secondary text-white text-[9px] font-mono font-bold">
                      AI FAQ
                    </span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant leading-tight mt-0.5">
                    Ask about queue delays, wait times, positions & hospital triage policies
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAssistantOpen(true)}
                className="w-full py-2.5 px-3 bg-secondary text-white rounded-xl text-xs font-bold hover:bg-secondary/90 active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                aria-label="Open SmartQueue Assistant FAQ"
              >
                <span className="material-symbols-outlined text-[16px]">chat</span>
                <span>Ask Questions & Check Status</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </section>

            {/* Lounge Instruction Notice */}
            <section className="bg-surface-container-low border border-outline-variant rounded-xl p-3.5 flex gap-3 items-start shadow-2xs">
              <div className="p-2 rounded-lg bg-surface-container-highest text-secondary shrink-0 mt-0.5">
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
            <section className="space-y-2.5">
              <button
                onClick={onOpenPass}
                className="w-full bg-white border-2 border-secondary text-secondary hover:bg-secondary-container/20 active:scale-95 transition-all rounded-xl py-3 px-4 flex items-center justify-center gap-2 font-bold shadow-xs text-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">qr_code_2</span>
                <span>View 30-Day Digital QR Pass</span>
              </button>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  onClick={() => {
                    setAssistanceRequested(true);
                    setTimeout(() => setAssistanceRequested(false), 4000);
                  }}
                  className={`border border-outline-variant active:scale-95 transition-all py-2.5 px-2 rounded-xl flex items-center justify-center gap-1.5 font-medium text-center cursor-pointer ${
                    assistanceRequested
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-white hover:bg-surface-container text-on-surface shadow-2xs'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px] text-primary">
                    {assistanceRequested ? 'check_circle' : 'accessible'}
                  </span>
                  <span>{assistanceRequested ? 'Nurse Summoned ✓' : 'Request Nurse'}</span>
                </button>
                <button
                  onClick={onLookupToken}
                  className="bg-white border border-outline-variant hover:bg-surface-container active:scale-95 transition-all text-on-surface py-2.5 px-2 rounded-xl flex items-center justify-center gap-1.5 font-medium text-center shadow-2xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px] text-primary">manage_search</span>
                  <span>Look Up Token</span>
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar (Hidden on md+ screens) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-40 flex justify-around items-center px-1.5 py-1.5 pb-safe bg-surface-container-lowest shadow-sm max-w-md left-1/2 -translate-x-1/2 border-t border-outline-variant/40">
        <button
          onClick={() => onNavigate('home')}
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary px-2.5 py-1 transition-colors"
        >
          <span className="material-symbols-outlined text-xl">home</span>
          <span className="text-[10px] mt-0.5">Home</span>
        </button>
        <button
          onClick={() => onNavigate('patient')}
          className="flex flex-col items-center justify-center text-secondary bg-secondary-container/20 rounded-lg px-2.5 py-1 font-semibold"
        >
          <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            queue
          </span>
          <span className="text-[10px] mt-0.5">Live Queue</span>
        </button>
        {onOpenScanner && (
          <button
            onClick={onOpenScanner}
            className="flex flex-col items-center justify-center text-primary px-2.5 py-1 transition-colors hover:text-secondary group cursor-pointer"
            title="Open Gate Scanner"
          >
            <span className="material-symbols-outlined text-xl font-bold group-hover:scale-110 transition-transform">qr_code_scanner</span>
            <span className="text-[10px] mt-0.5 font-bold">Scan Pass</span>
          </button>
        )}
        <button
          onClick={() => onNavigate('register')}
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary px-2.5 py-1 transition-colors"
        >
          <span className="material-symbols-outlined text-xl">assignment</span>
          <span className="text-[10px] mt-0.5">Check-In</span>
        </button>
        <button
          onClick={() => onNavigate('staff')}
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary px-2.5 py-1 transition-colors"
        >
          <span className="material-symbols-outlined text-xl">badge</span>
          <span className="text-[10px] mt-0.5">Staff</span>
        </button>
      </nav>

      {/* SmartQueue Assistant Modal */}
      <SmartQueueAssistant
        isOpen={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        patientToken={patientView.token}
        patientPassId={patientView.passId}
        patientDepartment={patientView.department}
      />
    </div>
  );
};
