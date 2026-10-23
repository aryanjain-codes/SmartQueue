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
  const genServing = queueState?.departments?.['General Medicine']?.nowServingToken || 'G-042';
  const cardServing = queueState?.departments?.['Cardiology']?.nowServingToken || 'C-108';
  const avgWait = queueState?.systemMetrics?.averageWaitMinutes ?? 18;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-surface-container-lowest flex flex-col relative pb-20 shadow-sm">
      {/* Top Bar */}
      <header className="bg-surface-container-lowest sticky top-0 z-40 w-full shadow-xs border-b border-outline-variant/30">
        <div className="flex justify-between items-center w-full px-4 h-14">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center text-secondary-fixed">
              <span className="material-symbols-outlined text-[20px]">local_hospital</span>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base text-primary tracking-tight leading-none">SmartQueue</span>
              <span className="text-[10px] text-on-surface-variant font-medium mt-0.5">St. Jude Memorial Hospital OPD</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onOpenScanner && (
              <button
                type="button"
                onClick={onOpenScanner}
                className="px-2.5 py-1 bg-secondary text-white hover:bg-on-secondary-container font-mono text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
                title="Open Gate Scanner Terminal"
              >
                <span className="material-symbols-outlined text-[15px]">qr_code_scanner</span>
                <span>Gate Scanner</span>
              </button>
            )}
            <button
              onClick={() => onNavigate('staff')}
              className="text-secondary font-mono text-xs font-semibold hover:underline flex items-center gap-0.5"
            >
              Staff Login
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Live Queue Ticker Banner */}
        <section className="bg-surface-container-low px-4 py-2 border-b border-outline-variant flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-live-dot absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-secondary"></span>
            </span>
            <span className="font-mono text-primary font-semibold">
              Current Average Wait: {avgWait} mins
            </span>
          </div>
          <span className="text-[11px] font-mono text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded">
            3 Active OPD Clinics
          </span>
        </section>

        {/* Hero Section */}
        <section className="p-4 pt-5 flex flex-col gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-container text-on-surface-variant text-[11px] font-semibold">
              <span className="material-symbols-outlined text-[14px] text-secondary">verified</span>
              <span>Accredited Triage Intelligence</span>
            </div>
            <h1 className="text-2xl font-bold text-primary tracking-tight leading-tight">
              Skip the Crowded Hospital Waiting Room
            </h1>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Register online, receive an instant digital OPD queue token, and monitor live doctor availability before you arrive.
            </p>
          </div>

          {/* Live OPD Quick Matrix Snapshot */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-3.5 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-outline-variant pb-2 mb-2">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-secondary text-[18px]">monitor_heart</span>
                <span className="font-mono text-xs font-semibold text-primary">Live Triage Status</span>
              </div>
              <span className="text-[10px] font-mono text-secondary font-bold uppercase tracking-wider">
                MONITOR ACTIVE
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-surface-container-low p-2.5 rounded-lg border-l-4 border-secondary">
                <span className="text-[10px] text-on-surface-variant block font-medium">Now Calling (Cardio)</span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="font-mono text-base text-primary font-bold">{cardServing}</span>
                  <span className="text-[10px] text-secondary font-semibold font-mono">Room 102</span>
                </div>
              </div>
              <div className="bg-surface-container-low p-2.5 rounded-lg border-l-4 border-outline">
                <span className="text-[10px] text-on-surface-variant block font-medium">Now Calling (General)</span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="font-mono text-base text-primary font-bold">{genServing}</span>
                  <span className="text-[10px] text-on-surface font-semibold font-mono">Room 104</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={() => onNavigate('register')}
              className="w-full bg-secondary text-white font-semibold py-3 px-4 rounded-lg shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all text-sm"
            >
              <span className="material-symbols-outlined text-[18px]">assignment</span>
              <span>Register for OPD Visit</span>
            </button>
            <div className="grid grid-cols-2 gap-2">
              {onOpenScanner && (
                <button
                  type="button"
                  onClick={onOpenScanner}
                  className="bg-primary hover:bg-primary-container text-white font-semibold py-2.5 px-3 rounded-lg shadow-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all text-xs"
                >
                  <span className="material-symbols-outlined text-[16px] text-secondary-fixed">qr_code_scanner</span>
                  <span>Scan Gate Pass</span>
                </button>
              )}
              <button
                onClick={() => onNavigate('staff')}
                className={`bg-surface-container-lowest text-primary border border-primary font-semibold py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 hover:bg-surface-container-low active:scale-95 transition-all text-xs ${
                  !onOpenScanner ? 'col-span-2' : ''
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">badge</span>
                <span>Staff Portal</span>
              </button>
            </div>
          </div>
        </section>

        {/* Key Features Bento Grid */}
        <section className="p-4 bg-surface-container-low/60 flex flex-col gap-3 border-t border-b border-outline-variant">
          <div>
            <h2 className="font-bold text-sm text-primary">System Capabilities</h2>
            <p className="text-xs text-on-surface-variant">Purpose-built for clinic efficiency and frictionless patient flow.</p>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {/* 1 */}
            <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant shadow-xs flex items-start gap-3">
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

            {/* 2 */}
            <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant shadow-xs flex items-start gap-3">
              <div className="p-2 rounded-lg bg-surface-container text-secondary shrink-0">
                <span className="material-symbols-outlined text-[20px]">timelapse</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold text-primary">Live Waiting Time Estimates</h3>
                  <span className="text-[9px] bg-secondary-container/40 text-on-secondary-container px-1 rounded font-bold font-mono">
                    Dynamic
                  </span>
                </div>
                <p className="text-[11px] text-on-surface-variant mt-0.5 leading-relaxed">
                  Dynamic wait prediction accounting for queue position, patient turnover rate, and doctor consultation pace.
                </p>
              </div>
            </div>

            {/* 3 */}
            <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant shadow-xs flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-surface-container text-secondary shrink-0">
                  <span className="material-symbols-outlined text-[20px]">qr_code_2</span>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-primary">Secure 30-Day QR Pass</h3>
                  <p className="text-[11px] text-on-surface-variant mt-0.5 leading-relaxed">
                    One-tap fast-track gate clearance without the hassle of printing thermal paper tickets or standing at kiosks.
                  </p>
                </div>
              </div>
              {onOpenScanner && (
                <button
                  type="button"
                  onClick={onOpenScanner}
                  className="shrink-0 px-2 py-1 bg-secondary text-white text-[11px] font-semibold rounded-lg hover:bg-on-secondary-container transition-colors flex items-center gap-1 shadow-xs self-center"
                  title="Open Gate Scanner"
                >
                  <span className="material-symbols-outlined text-[14px]">qr_code_scanner</span>
                  <span>Scan</span>
                </button>
              )}
            </div>

            {/* 4 */}
            <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant shadow-xs flex items-start gap-3">
              <div className="p-2 rounded-lg bg-surface-container text-secondary shrink-0">
                <span className="material-symbols-outlined text-[20px]">shield</span>
              </div>
              <div>
                <h3 className="text-xs font-bold text-primary">Privacy Guaranteed</h3>
                <p className="text-[11px] text-on-surface-variant mt-0.5 leading-relaxed">
                  Personal medical history is strictly scrubbed from QR passes, adhering strictly to hospital compliance protocols.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 3-Step Flow */}
        <section className="p-4 flex flex-col gap-3">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-secondary font-bold font-mono">Simplicity First</span>
            <h2 className="font-bold text-sm text-primary">How SmartQueue Operates</h2>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-full bg-primary-container text-white flex items-center justify-center font-mono font-bold text-xs shrink-0">
                1
              </div>
              <div className="bg-surface-container-lowest p-2.5 rounded-lg border border-outline-variant flex-1 shadow-xs">
                <h4 className="font-bold text-xs text-primary">Fill Basic Info & Select OPD</h4>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Select department (General Medicine, Cardiology, Orthopaedics) and provide patient details.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-full bg-primary-container text-white flex items-center justify-center font-mono font-bold text-xs shrink-0">
                2
              </div>
              <div className="bg-surface-container-lowest p-2.5 rounded-lg border border-outline-variant flex-1 shadow-xs">
                <h4 className="font-bold text-xs text-primary">Get Digital Token & 30-Day Pass</h4>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Receive instant digital token with live estimated wait countdown and clearance QR pass.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-full bg-secondary text-white flex items-center justify-center font-mono font-bold text-xs shrink-0">
                3
              </div>
              <div className="bg-surface-container-lowest p-2.5 rounded-lg border border-outline-variant flex-1 shadow-xs">
                <h4 className="font-bold text-xs text-primary">Arrive Exactly When Called</h4>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Walk directly into consultation lobby 10 minutes prior to call alert, skipping crowded corridor waiting.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Emergency Notice */}
        <section className="mx-4 mb-4 p-3 bg-red-50 rounded-xl border border-red-200 flex items-start gap-2 text-xs">
          <span className="material-symbols-outlined text-error text-[20px] shrink-0 mt-0.5">emergency</span>
          <div>
            <h4 className="font-bold text-error uppercase tracking-wider text-[11px]">Critical Medical Notice</h4>
            <p className="text-[11px] text-on-surface mt-0.5 leading-snug">
              For trauma or critical medical emergencies, proceed immediately to the 24/7 ER Trauma Center or dial 911. SmartQueue is for non-critical OPD clinics only.
            </p>
          </div>
        </section>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 w-full z-40 flex justify-around items-center px-1.5 py-1.5 pb-safe bg-surface-container-lowest shadow-sm max-w-md left-1/2 -translate-x-1/2 border-t border-outline-variant/40">
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
