import React from 'react';
import { AnyQueueState } from '../types/queue';

interface HomeViewProps {
  queueState: AnyQueueState | null;
  onNavigate: (view: 'home' | 'register' | 'patient' | 'staff' | 'analytics') => void;
  onLookupToken: () => void;
  onOpenScanner?: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  queueState,
  onNavigate,
  onLookupToken,
  onOpenScanner,
}) => {
  const genServing = queueState?.departments?.['General Medicine']?.nowServingToken || 'MED-039';
  const cardServing = queueState?.departments?.['Cardiology']?.nowServingToken || 'CARD-012';
  const orthServing = queueState?.departments?.['Orthopaedics']?.nowServingToken || 'ORTH-024';
  const avgWait = queueState?.systemMetrics?.averageWaitMinutes ?? 14;
  const inWaiting = queueState?.systemMetrics?.inWaiting ?? 17;
  const totalServed = queueState?.systemMetrics?.totalServed ?? 20;

  return (
    <div className="w-full max-w-md md:max-w-4xl lg:max-w-5xl mx-auto min-h-screen bg-surface-container-lowest flex flex-col relative pb-20 md:pb-8 shadow-sm">
      {/* Top Header */}
      <header className="bg-surface-container-lowest sticky top-0 z-40 w-full shadow-xs border-b border-outline-variant/30">
        <div className="flex justify-between items-center w-full px-4 md:px-6 h-14">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary-container flex items-center justify-center text-secondary-fixed shadow-xs">
              <span className="material-symbols-outlined text-[22px]">local_hospital</span>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base text-primary tracking-tight leading-none">SmartQueue</span>
              <span className="text-[10px] text-on-surface-variant font-medium mt-0.5">St. Jude Memorial Hospital OPD</span>
            </div>
          </div>

          {/* Desktop & Mobile Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onLookupToken}
              className="hidden sm:inline-flex px-2.5 py-1 text-xs font-semibold text-primary hover:bg-surface-container rounded-lg transition-colors items-center gap-1"
              title="Track Token"
            >
              <span className="material-symbols-outlined text-[16px]">manage_search</span>
              <span>Track Token</span>
            </button>
            <button
              onClick={() => onNavigate('analytics')}
              className="hidden md:inline-flex px-2.5 py-1 text-xs font-semibold text-primary hover:bg-surface-container rounded-lg transition-colors items-center gap-1"
              title="Queue Analytics"
            >
              <span className="material-symbols-outlined text-[16px]">monitoring</span>
              <span>Analytics</span>
            </button>
            {onOpenScanner && (
              <button
                type="button"
                onClick={onOpenScanner}
                className="px-2.5 py-1 bg-secondary text-white hover:bg-on-secondary-container font-mono text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
                title="Open Gate Scanner Terminal"
              >
                <span className="material-symbols-outlined text-[15px]">qr_code_scanner</span>
                <span>Gate Scanner</span>
              </button>
            )}
            <button
              onClick={() => onNavigate('staff')}
              className="text-secondary font-mono text-xs font-semibold hover:underline flex items-center gap-0.5 ml-1"
            >
              Staff Portal
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Live Queue Ticker Banner */}
        <section className="bg-surface-container-low px-4 md:px-6 py-2 border-b border-outline-variant flex flex-wrap items-center justify-between text-xs gap-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-live-dot absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-secondary"></span>
            </span>
            <span className="font-mono text-primary font-semibold">
              Real-Time Dynamic Wait: ~{avgWait} mins
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded">
              {inWaiting} in queue • {totalServed} served today
            </span>
            <span className="text-[11px] font-mono text-secondary bg-secondary-container/40 px-2 py-0.5 rounded font-bold hidden sm:inline-block">
              3 Active OPD Clinics
            </span>
          </div>
        </section>

        {/* Hero Section (Responsive Grid on Tablet/Desktop) */}
        <div className="p-4 md:p-6 md:grid md:grid-cols-12 md:gap-6 md:items-start">
          {/* Left Column: Hero & Actions */}
          <div className="md:col-span-7 flex flex-col gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary-container/30 text-secondary text-[11px] font-semibold border border-secondary/20">
                <span className="material-symbols-outlined text-[14px]">verified</span>
                <span>Accredited Hospital Queue OS & Dynamic ETA</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-primary tracking-tight leading-tight">
                Skip the Crowded Hospital Waiting Lounge
              </h1>
              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                Register online, receive an instant encrypted digital token, and monitor physician availability in real time with our dynamic ETA engine.
              </p>
            </div>

            {/* Live OPD Quick Matrix Snapshot */}
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-3.5 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-outline-variant/60 pb-2 mb-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-secondary text-[18px]">monitor_heart</span>
                  <span className="font-mono text-xs font-bold text-primary">Live Triage Status</span>
                </div>
                <span className="text-[10px] font-mono text-secondary font-bold uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
                  MONITOR ACTIVE
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="bg-surface-container-low p-2.5 rounded-lg border-l-4 border-secondary interactive-card">
                  <span className="text-[10px] text-on-surface-variant block font-medium">Cardiology</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="font-mono text-base text-primary font-bold">{cardServing}</span>
                    <span className="text-[10px] text-secondary font-semibold font-mono">Room 102</span>
                  </div>
                  <span className="text-[9px] text-on-surface-variant font-mono block mt-0.5">Dr. Marcus Vance</span>
                </div>
                <div className="bg-surface-container-low p-2.5 rounded-lg border-l-4 border-outline interactive-card">
                  <span className="text-[10px] text-on-surface-variant block font-medium">General Medicine</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="font-mono text-base text-primary font-bold">{genServing}</span>
                    <span className="text-[10px] text-on-surface font-semibold font-mono">Room 104</span>
                  </div>
                  <span className="text-[9px] text-on-surface-variant font-mono block mt-0.5">Dr. Sarah Jenkins</span>
                </div>
                <div className="bg-surface-container-low p-2.5 rounded-lg border-l-4 border-primary interactive-card sm:col-span-1">
                  <span className="text-[10px] text-on-surface-variant block font-medium">Orthopaedics</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="font-mono text-base text-primary font-bold">{orthServing}</span>
                    <span className="text-[10px] text-primary font-semibold font-mono">Room 105</span>
                  </div>
                  <span className="text-[9px] text-on-surface-variant font-mono block mt-0.5">Dr. Keith Thorne</span>
                </div>
              </div>
            </div>

            {/* Action CTAs */}
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                onClick={() => onNavigate('register')}
                className="flex-1 bg-secondary text-white font-semibold py-3 px-4 rounded-xl shadow-xs flex items-center justify-center gap-2 active:scale-95 transition-all text-sm hover:bg-secondary/90 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">assignment</span>
                <span>Register for OPD Visit</span>
              </button>
              <button
                onClick={onLookupToken}
                className="bg-surface-container text-primary font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 hover:bg-surface-container-high active:scale-95 transition-all text-xs border border-outline-variant cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">manage_search</span>
                <span>Check My Token</span>
              </button>
            </div>
          </div>

          {/* Right Column: Key Capabilities Bento Grid */}
          <div className="md:col-span-5 flex flex-col gap-3 mt-4 md:mt-0">
            <div>
              <h2 className="font-bold text-sm text-primary flex items-center gap-1.5">
                <span className="material-symbols-outlined text-secondary text-[18px]">verified_user</span>
                <span>System Capabilities</span>
              </h2>
              <p className="text-xs text-on-surface-variant">Purpose-built for clinical efficiency and frictionless patient flow.</p>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {/* Feature 1 */}
              <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant shadow-xs flex items-start gap-3 interactive-card">
                <div className="p-2 rounded-lg bg-surface-container text-secondary shrink-0">
                  <span className="material-symbols-outlined text-[20px]">pin</span>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-primary">Smart Digital Tokens</h3>
                  <p className="text-[11px] text-on-surface-variant mt-0.5 leading-relaxed">
                    Real-time queue numbering synchronized directly with active clinic consultation rooms and patient call displays.
                  </p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant shadow-xs flex items-start gap-3 interactive-card">
                <div className="p-2 rounded-lg bg-surface-container text-secondary shrink-0">
                  <span className="material-symbols-outlined text-[20px]">timelapse</span>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-bold text-primary">Dynamic ETA Engine</h3>
                    <span className="text-[9px] bg-secondary-container/40 text-on-secondary-container px-1.5 rounded-full font-bold font-mono">
                      Real-Time
                    </span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant mt-0.5 leading-relaxed">
                    Deterministic wait prediction accounting for multi-desk capacity, triage priority, and historical consultation durations.
                  </p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant shadow-xs flex items-start justify-between gap-3 interactive-card">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-surface-container text-secondary shrink-0">
                    <span className="material-symbols-outlined text-[20px]">qr_code_2</span>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-primary">30-Day Digital QR Pass</h3>
                    <p className="text-[11px] text-on-surface-variant mt-0.5 leading-relaxed">
                      Encrypted 128-bit digital pass for gate clearance without printing thermal paper tickets.
                    </p>
                  </div>
                </div>
              </div>

              {/* Feature 4: SmartQueue Assistant */}
              <div className="bg-surface-container-lowest p-3 rounded-xl border border-secondary/30 shadow-xs flex items-start gap-3 interactive-card bg-gradient-to-r from-secondary-container/10 to-transparent">
                <div className="p-2 rounded-lg bg-secondary text-white shrink-0">
                  <span className="material-symbols-outlined text-[20px]">smart_toy</span>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-bold text-primary">SmartQueue Assistant</h3>
                    <span className="text-[9px] bg-secondary text-white px-1.5 rounded-full font-bold font-mono">
                      AI Powered
                    </span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant mt-0.5 leading-relaxed">
                    Instant answers to delays, queue positions, and triage policies anchored strictly to live hospital facts.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3-Step Flow */}
        <section className="p-4 md:p-6 bg-surface-container-low/60 border-t border-b border-outline-variant flex flex-col gap-3">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-secondary font-bold font-mono">Simplicity First</span>
            <h2 className="font-bold text-sm text-primary">How SmartQueue Operates</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="bg-surface-container-lowest p-3.5 rounded-xl border border-outline-variant shadow-xs flex items-start gap-3 interactive-card">
              <div className="w-7 h-7 rounded-full bg-primary-container text-white flex items-center justify-center font-mono font-bold text-xs shrink-0">
                1
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-xs text-primary">Fill Basic Info & Select OPD</h4>
                <p className="text-[11px] text-on-surface-variant mt-0.5 leading-relaxed">
                  Select department (General Medicine, Cardiology, Orthopaedics) and provide patient details with instant Indian phone validation.
                </p>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-3.5 rounded-xl border border-outline-variant shadow-xs flex items-start gap-3 interactive-card">
              <div className="w-7 h-7 rounded-full bg-primary-container text-white flex items-center justify-center font-mono font-bold text-xs shrink-0">
                2
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-xs text-primary">Get Digital Token & QR Pass</h4>
                <p className="text-[11px] text-on-surface-variant mt-0.5 leading-relaxed">
                  Receive instant digital token with live estimated wait countdown and encrypted 30-day clearance QR pass.
                </p>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-3.5 rounded-xl border border-outline-variant shadow-xs flex items-start gap-3 interactive-card">
              <div className="w-7 h-7 rounded-full bg-secondary text-white flex items-center justify-center font-mono font-bold text-xs shrink-0">
                3
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-xs text-primary">Arrive Exactly When Called</h4>
                <p className="text-[11px] text-on-surface-variant mt-0.5 leading-relaxed">
                  Walk into the consultation room 10 minutes prior to call alert, skipping crowded corridor waiting.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Emergency Notice */}
        <section className="mx-4 md:mx-6 my-4 p-3 bg-red-50/80 rounded-xl border border-red-200/80 flex items-start gap-2.5 text-xs shadow-2xs">
          <span className="material-symbols-outlined text-error text-[20px] shrink-0 mt-0.5">emergency</span>
          <div>
            <h4 className="font-bold text-error uppercase tracking-wider text-[11px]">Critical Medical Notice</h4>
            <p className="text-[11px] text-on-surface mt-0.5 leading-snug">
              For trauma, sudden acute chest pain, or critical medical emergencies, proceed immediately to the 24/7 ER Trauma Center or dial 911. SmartQueue is for outpatient (OPD) clinics only.
            </p>
          </div>
        </section>
      </main>

      {/* Mobile Bottom Navigation Bar (Hidden on md+ screens where top nav is visible) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-40 flex justify-around items-center px-1.5 py-1.5 pb-safe bg-surface-container-lowest shadow-sm max-w-md left-1/2 -translate-x-1/2 border-t border-outline-variant/40">
        <button
          onClick={() => onNavigate('home')}
          className="flex flex-col items-center justify-center text-secondary bg-secondary-container/20 rounded-lg px-2.5 py-1 font-semibold"
        >
          <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            queue
          </span>
          <span className="text-[10px] mt-0.5">Home</span>
        </button>
        <button
          onClick={() => onNavigate('register')}
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary px-2.5 py-1 transition-colors"
        >
          <span className="material-symbols-outlined text-xl">assignment</span>
          <span className="text-[10px] mt-0.5">Register</span>
        </button>
        {onOpenScanner && (
          <button
            type="button"
            onClick={onOpenScanner}
            className="flex flex-col items-center justify-center text-primary px-2.5 py-1 transition-colors hover:text-secondary group cursor-pointer"
            title="Gate Scanner Terminal (Scan QR)"
          >
            <span className="material-symbols-outlined text-xl font-bold group-hover:scale-110 transition-transform">qr_code_scanner</span>
            <span className="text-[10px] mt-0.5 font-bold">Scan QR</span>
          </button>
        )}
        <button
          onClick={onLookupToken}
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary px-2.5 py-1 transition-colors"
          title="Track Patient OPD Token"
        >
          <span className="material-symbols-outlined text-xl">manage_search</span>
          <span className="text-[10px] mt-0.5">Check Token</span>
        </button>
        <button
          onClick={() => onNavigate('staff')}
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary px-2.5 py-1 transition-colors"
        >
          <span className="material-symbols-outlined text-xl">badge</span>
          <span className="text-[10px] mt-0.5">Staff</span>
        </button>
      </nav>
    </div>
  );
};
