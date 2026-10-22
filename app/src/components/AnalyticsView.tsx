import React, { useState } from 'react';
import { AnyQueueState } from '../types/queue';

interface AnalyticsViewProps {
  queueState: AnyQueueState;
  onNavigate: (view: 'home' | 'register' | 'patient' | 'staff' | 'analytics') => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ queueState, onNavigate }) => {
  const [recommendationApproved, setRecommendationApproved] = useState(false);
  const [recommendationDismissed, setRecommendationDismissed] = useState(false);

  const totalPatients = queueState.systemMetrics.totalCheckedIn;
  const avgWait = queueState.systemMetrics.averageWaitMinutes;
  const inWaiting = queueState.systemMetrics.inWaiting;

  // Real departmental counts from backend database
  const genPatients = queueState.patients.filter((p) => p.department === 'General Medicine').length;
  const cardPatients = queueState.patients.filter((p) => p.department === 'Cardiology').length;
  const orthPatients = queueState.patients.filter((p) => p.department === 'Orthopaedics').length;
  const totalDbPatients = Math.max(1, queueState.patients.length);

  const genPct = Math.round((genPatients / totalDbPatients) * 100);
  const cardPct = Math.round((cardPatients / totalDbPatients) * 100);
  const orthPct = Math.round((orthPatients / totalDbPatients) * 100);

  return (
    <div className="h-screen w-full flex overflow-hidden font-sans text-on-surface bg-background">
      {/* LEFT SIDEBAR NAVIGATION */}
      <aside className="w-56 shrink-0 bg-surface-container-low border-r border-outline-variant hidden md:flex flex-col justify-between z-20">
        <div className="p-3 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-outline-variant">
            <div className="w-9 h-9 rounded-lg bg-primary text-white flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-secondary-fixed text-xl">local_hospital</span>
            </div>
            <div>
              <div className="font-bold text-sm text-primary tracking-tight leading-tight">SmartQueue</div>
              <div className="text-[10px] text-on-surface-variant font-mono">Clinical Ops OS</div>
            </div>
          </div>

          <nav className="flex flex-col gap-1 text-xs">
            <button
              onClick={() => onNavigate('staff')}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container text-left"
            >
              <span className="material-symbols-outlined text-[18px]">queue</span>
              <span>Live OPD Queues</span>
              <span className="ml-auto font-mono text-[10px] bg-surface-container px-1.5 py-0.2 rounded">
                {inWaiting}
              </span>
            </button>
            <button
              onClick={() => onNavigate('register')}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container text-left"
            >
              <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
              <span>Register Patient</span>
            </button>
            <div className="text-[10px] font-mono text-outline uppercase px-3 pt-2 pb-1">Predictive Intelligence</div>
            <button
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-container-high text-secondary font-bold border-l-4 border-secondary text-left shadow-xs"
            >
              <span className="material-symbols-outlined text-[18px]">monitoring</span>
              <span>Queue Analytics</span>
              <span className="ml-auto w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            </button>
            <button
              onClick={() => onNavigate('patient')}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container text-left"
            >
              <span className="material-symbols-outlined text-[18px]">smartphone</span>
              <span>Patient Mobile App</span>
            </button>
          </nav>
        </div>

        <div className="p-3 border-t border-outline-variant bg-surface-container/50 text-[11px] font-mono">
          <div className="flex items-center justify-between text-outline">
            <span>GATEWAY TELEMETRY</span>
            <span className="text-secondary font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span> ONLINE
            </span>
          </div>
          <div className="text-[10px] text-on-surface-variant mt-1">
            Active Tokens: <strong className="text-primary font-semibold">{inWaiting + 2} in flow</strong>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        <header className="h-14 bg-surface-container-lowest border-b border-outline-variant flex items-center justify-between px-4 sm:px-6 shrink-0 shadow-xs z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('staff')}
              className="p-1 rounded-lg text-on-surface hover:bg-surface-container md:hidden"
            >
              <span className="material-symbols-outlined text-xl">arrow_back</span>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-sm sm:text-base text-primary tracking-tight">
                  OPD Flow & Predictive Queue Analytics
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-surface-container text-on-surface-variant">
                  Live Monitor
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant">St. Jude Memorial Hospital Central Outpatient Wing</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('staff')}
              className="h-8 px-3 rounded bg-surface-container text-primary text-xs font-semibold hover:bg-surface-container-high transition-colors"
            >
              Back to Queues
            </button>
          </div>
        </header>

        {/* Dashboard Canvas */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* 4 KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* KPI 1 */}
            <div className="bg-surface-container-lowest p-3.5 rounded-lg border border-outline-variant shadow-xs flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-secondary"></div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-on-surface-variant">
                Total Patients Checked-In
              </span>
              <div className="my-2 flex items-baseline gap-2">
                <span className="font-mono text-2xl sm:text-3xl font-bold text-primary">{totalPatients}</span>
                <span className="text-[11px] text-secondary font-mono font-semibold">+14% vs avg</span>
              </div>
              <div className="text-[10px] text-outline font-mono pt-1 border-t border-outline-variant/50">
                Walk-ins: 198 • Scheduled: 144
              </div>
            </div>

            {/* KPI 2 */}
            <div className="bg-surface-container-lowest p-3.5 rounded-lg border border-outline-variant shadow-xs flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-secondary"></div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-on-surface-variant">
                Current Average Wait
              </span>
              <div className="my-2 flex items-baseline gap-2">
                <span className="font-mono text-2xl sm:text-3xl font-bold text-primary">{avgWait}</span>
                <span className="text-xs text-on-surface-variant">mins</span>
                <span className="ml-auto px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-surface-container-high text-secondary">
                  Target &lt;20m
                </span>
              </div>
              <div className="text-[10px] text-secondary font-mono pt-1 border-t border-outline-variant/50">
                ✓ SLA Compliant (Within Buffer)
              </div>
            </div>

            {/* KPI 3 */}
            <div className="bg-surface-container-lowest p-3.5 rounded-lg border border-outline-variant shadow-xs flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-outline"></div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-on-surface-variant">
                Busiest Clinic
              </span>
              <div className="my-2">
                <span className="text-sm sm:text-base font-bold text-primary block truncate">General Medicine</span>
                <span className="text-xs font-mono text-on-surface-variant">84 visits registered</span>
              </div>
              <div className="text-[10px] text-outline font-mono pt-1 border-t border-outline-variant/50">
                Active Desks: 3 • Load: 92%
              </div>
            </div>

            {/* KPI 4 */}
            <div className="bg-surface-container-lowest p-3.5 rounded-lg border border-outline-variant shadow-xs flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary-container"></div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-on-surface-variant">
                Predicted Peak Rush
              </span>
              <div className="my-2">
                <span className="text-xs sm:text-sm font-mono font-bold text-primary block">11:00 AM - 01:30 PM</span>
                <span className="text-[11px] text-amber-700 font-medium">Projected influx: ~115</span>
              </div>
              <div className="text-[10px] text-primary font-mono pt-1 border-t border-outline-variant/50">
                Staff Buffer: Triage Lv 2 Ready
              </div>
            </div>
          </div>

          {/* Visualization Grid: Chart + Distribution Donut */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Chart (8 cols) */}
            <div className="lg:col-span-8 bg-surface-container-lowest p-4 rounded-xl border border-outline-variant shadow-xs flex flex-col justify-between">
              <div className="flex items-start justify-between pb-3 border-b border-outline-variant/70">
                <div>
                  <h3 className="font-bold text-xs sm:text-sm text-primary">Hourly Patient Arrivals & Queue Congestion</h3>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    Patient check-ins vs active queue volume across operational hours (07:00 AM – 06:00 PM).
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 bg-primary rounded-xs"></span> Volume
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-1 bg-secondary rounded-full"></span> Queue Load
                  </span>
                </div>
              </div>

              {/* Chart Graphic */}
              <div className="mt-4 relative h-52 w-full flex items-end justify-between gap-1 pt-6 px-2">
                {[
                  { time: '07 AM', h: 18, pts: 11 },
                  { time: '08 AM', h: 32, pts: 19 },
                  { time: '09 AM', h: 52, pts: 31 },
                  { time: '10 AM', h: 84, pts: 50, peak: 'PEAK 1' },
                  { time: '11 AM', h: 68, pts: 41 },
                  { time: '12 PM', h: 58, pts: 35 },
                  { time: '01 PM', h: 88, pts: 53, peak: 'PEAK 2' },
                  { time: '02 PM', h: 72, pts: 43 },
                  { time: '03 PM', h: 48, pts: 29 },
                  { time: '04 PM', h: 32, pts: 19 },
                  { time: '05 PM', h: 22, pts: 13 },
                  { time: '06 PM', h: 12, pts: 7 },
                ].map((bar, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                    {bar.peak && (
                      <span className="text-[8px] font-mono font-bold text-secondary mb-1">
                        {bar.peak}
                      </span>
                    )}
                    <div
                      style={{ height: `${bar.h}%` }}
                      className={`w-full max-w-[28px] rounded-t transition-all ${
                        bar.peak ? 'bg-primary' : 'bg-primary/70 group-hover:bg-primary'
                      }`}
                    ></div>
                    <span className="text-[9px] font-mono text-outline mt-1.5 truncate">{bar.time}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Distribution (4 cols) */}
            <div className="lg:col-span-4 bg-surface-container-lowest p-4 rounded-xl border border-outline-variant shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-outline-variant">
                  <h3 className="font-bold text-xs sm:text-sm text-primary">
                    Live OPD Caseload Distribution
                  </h3>
                  <span className="text-[9px] font-mono bg-secondary-container/30 text-secondary px-1.5 py-0.2 rounded font-bold">
                    Real DB
                  </span>
                </div>
                <div className="my-3 space-y-2.5 text-xs">
                  <div>
                    <div className="flex justify-between font-mono mb-1">
                      <span className="text-primary font-semibold">General Medicine</span>
                      <span className="font-bold text-primary">{genPct}% ({genPatients} pt)</span>
                    </div>
                    <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                      <div className="bg-primary h-full transition-all duration-300" style={{ width: `${genPct}%` }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between font-mono mb-1">
                      <span className="text-secondary font-semibold">Cardiology</span>
                      <span className="font-bold text-primary">{cardPct}% ({cardPatients} pt)</span>
                    </div>
                    <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                      <div className="bg-secondary h-full transition-all duration-300" style={{ width: `${cardPct}%` }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between font-mono mb-1">
                      <span className="text-primary font-semibold">Orthopaedics</span>
                      <span className="font-bold text-primary">{orthPct}% ({orthPatients} pt)</span>
                    </div>
                    <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                      <div className="bg-surface-tint h-full transition-all duration-300" style={{ width: `${orthPct}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-outline-variant/60 text-[10px] font-mono text-outline flex justify-between">
                <span>ACTIVE DEPARTMENTS: 3</span>
                <span className="text-secondary font-semibold">Live State Synchronized</span>
              </div>
            </div>
          </div>

          {/* AI Recommendation Engine */}
          {!recommendationDismissed && (
            <div className="bg-primary-container text-white p-4 rounded-xl border border-secondary/40 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-secondary text-white flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-xl">smart_toy</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-secondary-fixed uppercase tracking-wider font-mono">
                      AI SmartQueue Recommendation
                    </span>
                    <span className="text-[10px] bg-secondary-container/30 px-1.5 py-0.2 rounded text-secondary-fixed">
                      Action Available
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white mt-0.5">
                    Deploy Additional Doctor to Room 105 at 11:30 AM
                  </h4>
                  <p className="text-xs text-primary-fixed-dim leading-relaxed mt-0.5 max-w-2xl">
                    Predicted rush in General Medicine between 11:00 AM - 01:30 PM will breach the 20-min wait SLA. Opening Room 105 Counter #04 will reduce average patient waiting time by <strong className="text-white font-semibold">34% (saving ~11 mins per patient)</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setRecommendationDismissed(true)}
                  className="px-3 py-1.5 rounded border border-white/30 text-xs text-white/80 hover:bg-white/10 transition-colors"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => setRecommendationApproved(true)}
                  disabled={recommendationApproved}
                  className={`px-4 py-1.5 rounded text-xs font-bold transition-all shadow-xs ${
                    recommendationApproved
                      ? 'bg-emerald-600 text-white'
                      : 'bg-secondary text-white hover:bg-on-secondary-container active:scale-95'
                  }`}
                >
                  {recommendationApproved ? 'Routed to Counter 105 ✓' : 'Approve & Route Doctor'}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
