import React, { useState, useEffect } from 'react';
import {
  staffCallNext,
  staffCompleteConsultation,
  staffHoldLab,
  staffCallToken,
  resetDemoData,
} from '../services/api';
import { OPDDepartment, PatientRecord, SmartQueueState } from '../types/queue';

interface StaffDashboardViewProps {
  queueState: SmartQueueState;
  onRefresh: () => void;
  onNavigate: (view: 'home' | 'register' | 'patient' | 'staff' | 'analytics') => void;
  onOpenScanner: () => void;
  onViewPatientChart: (patient: PatientRecord) => void;
}

export const StaffDashboardView: React.FC<StaffDashboardViewProps> = ({
  queueState,
  onRefresh,
  onNavigate,
  onOpenScanner,
  onViewPatientChart,
}) => {
  const [selectedDept, setSelectedDept] = useState<OPDDepartment>('General Medicine');
  const [searchQuery, setSearchQuery] = useState('');
  const [consultationTimer, setConsultationTimer] = useState<number>(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const deptData = queueState.departments[selectedDept] || queueState.departments['General Medicine'];
  const currentServing = deptData?.nowServingPatient || null;

  // Department waiting patients
  const allDeptPatients = queueState.patients.filter((p) => p.department === selectedDept);
  const waitingPatients = allDeptPatients.filter((p) => p.status === 'WAITING');
  const nextWaitingPatient = waitingPatients[0] || null;

  // Filter queue roster by search
  const filteredPatients = allDeptPatients.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.token.toLowerCase().includes(q) ||
      p.fullName.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      (p.mrn && p.mrn.toLowerCase().includes(q))
    );
  });

  // Live timer for active consultation
  useEffect(() => {
    if (currentServing && currentServing.calledAt) {
      const startMs = new Date(currentServing.calledAt).getTime();
      const initialSeconds = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      setConsultationTimer(initialSeconds);

      const interval = setInterval(() => {
        setConsultationTimer((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setConsultationTimer(0);
    }
  }, [currentServing?.token, currentServing?.calledAt]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleCallNext = async () => {
    setActionLoading(true);
    setActionFeedback(null);
    try {
      const res = await staffCallNext(selectedDept);
      if (res.current) {
        setActionFeedback(`Called Token ${res.current.token} (${res.current.fullName}) to ${deptData.room}`);
      } else {
        setActionFeedback('No more waiting patients in queue for this department.');
      }
      onRefresh();
    } catch (err: any) {
      console.error(err);
      setActionFeedback(err.message || 'Failed to call next patient');
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!currentServing) {
      setActionFeedback('No patient currently in consultation to complete.');
      return;
    }
    setActionLoading(true);
    setActionFeedback(null);
    try {
      const res = await staffCompleteConsultation(selectedDept);
      if (res.completed) {
        setActionFeedback(`Completed consultation for ${res.completed.fullName} (${res.completed.token}). Patient discharged.`);
      }
      onRefresh();
    } catch (err: any) {
      console.error(err);
      setActionFeedback(err.message || 'Failed to complete consultation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleHoldLab = async (token: string) => {
    setActionLoading(true);
    try {
      await staffHoldLab(token);
      setActionFeedback(`Patient with Token ${token} sent to Diagnostic Lab hold.`);
      onRefresh();
    } catch (err: any) {
      console.error(err);
      setActionFeedback(err.message || 'Failed to place on hold');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCallSpecific = async (token: string) => {
    setActionLoading(true);
    try {
      const res = await staffCallToken(token);
      setActionFeedback(`Called patient ${res.patient.fullName} (${token}) into ${deptData.room}`);
      onRefresh();
    } catch (err: any) {
      console.error(err);
      setActionFeedback(err.message || 'Failed to call token');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetDemo = async () => {
    setActionLoading(true);
    try {
      await resetDemoData();
      setActionFeedback('System state reset to demonstration baseline.');
      onRefresh();
    } catch (err: any) {
      console.error(err);
      setActionFeedback('Failed to reset demo state.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex overflow-hidden font-sans text-on-surface bg-background">
      {/* LEFT SIDEBAR NAVIGATION */}
      <aside className="w-56 shrink-0 bg-surface-container-low border-r border-outline-variant hidden md:flex flex-col justify-between z-20">
        <div className="flex flex-col">
          {/* Brand Header */}
          <div className="h-14 px-4 flex items-center gap-2 border-b border-outline-variant bg-surface-container-lowest">
            <span className="material-symbols-outlined text-secondary text-2xl">local_hospital</span>
            <div>
              <div className="font-bold text-sm text-primary tracking-tight leading-tight">SmartQueue</div>
              <div className="text-[10px] text-on-surface-variant font-mono">St. Jude OPD Portal</div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-2 space-y-1">
            {/* Live OPD Queues (Active) */}
            <button
              type="button"
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-surface-container-high text-secondary font-semibold text-xs border-l-4 border-secondary transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">queue</span>
                <span>Live OPD Queues</span>
              </div>
              <span className="text-[10px] font-mono bg-secondary text-white px-1.5 py-0.2 rounded-full">
                {waitingPatients.length}
              </span>
            </button>

            {/* Gate Pass Scanner */}
            <button
              type="button"
              onClick={onOpenScanner}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors text-xs text-left"
            >
              <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
              <span>Gate Pass Scanner</span>
            </button>

            {/* Patient Registration */}
            <button
              type="button"
              onClick={() => onNavigate('register')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors text-xs text-left"
            >
              <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
              <span>Register Patient</span>
            </button>

            {/* Queue Analytics */}
            <button
              type="button"
              onClick={() => onNavigate('analytics')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors text-xs text-left"
            >
              <span className="material-symbols-outlined text-[18px]">analytics</span>
              <span>Queue Analytics</span>
            </button>

            {/* Patient Mobile View Switcher */}
            <button
              type="button"
              onClick={() => onNavigate('patient')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors text-xs text-left"
            >
              <span className="material-symbols-outlined text-[18px]">smartphone</span>
              <span>Patient Live View</span>
            </button>

            {/* Reset Demo */}
            <button
              type="button"
              onClick={handleResetDemo}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-on-surface-variant hover:bg-red-50 hover:text-error transition-colors text-xs text-left"
            >
              <span className="material-symbols-outlined text-[18px]">restart_alt</span>
              <span>Reset Demo State</span>
            </button>
          </nav>
        </div>

        {/* Doctor Profile Widget */}
        <div className="p-2 border-t border-outline-variant bg-surface-container-lowest">
          <div className="p-2 rounded-lg bg-surface-container-low flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs">
                SJ
              </div>
              <div className="overflow-hidden">
                <div className="text-xs text-primary font-bold truncate">Dr. Sarah Jenkins</div>
                <div className="flex items-center gap-1 text-[9px] text-secondary font-semibold font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
                  Suite B • On Duty
                </div>
              </div>
            </div>
            <button
              onClick={() => onNavigate('home')}
              className="text-on-surface-variant hover:text-error transition-colors p-1 rounded"
              title="Return to Landing"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* TOP UTILITY BAR */}
        <header className="h-14 bg-surface-container-lowest border-b border-outline-variant px-4 flex items-center justify-between gap-3 shrink-0 z-10">
          <div className="flex items-center gap-3">
            {/* Mobile menu / title */}
            <div className="md:hidden flex items-center gap-1.5">
              <span className="material-symbols-outlined text-secondary text-xl">local_hospital</span>
              <span className="font-bold text-sm text-primary">SmartQueue</span>
            </div>

            {/* Department Selector */}
            <div className="flex items-center gap-2 bg-surface-container-low px-2.5 py-1.5 rounded-lg border border-outline-variant">
              <span className="material-symbols-outlined text-secondary text-[16px]">meeting_room</span>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value as OPDDepartment)}
                className="bg-transparent border-none text-xs font-bold text-primary focus:outline-none cursor-pointer pr-1"
              >
                <option value="General Medicine">General Medicine (Room 104)</option>
                <option value="Cardiology">Cardiology (Room 102)</option>
                <option value="Orthopaedics">Orthopaedics (Room 105)</option>
              </select>
            </div>

            {/* Counter Active */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-surface-container rounded-lg border border-outline-variant text-xs">
              <span className="w-2 h-2 rounded-full bg-secondary"></span>
              <span className="font-mono text-primary font-semibold">Desk Online</span>
            </div>
          </div>

          {/* Velocity Indicator */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded bg-secondary-container/20 text-on-secondary-container border border-secondary-container text-xs">
            <span className="material-symbols-outlined text-[16px]">speed</span>
            <span>
              Velocity: <strong>4.2 mins/patient</strong> (Target nominal)
            </span>
          </div>

          {/* Search & Actions */}
          <div className="flex items-center gap-2">
            <div className="relative w-44 sm:w-60">
              <span className="material-symbols-outlined absolute left-2 top-2 text-[16px] text-outline">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Token #, Name, ID..."
                className="w-full pl-7 pr-3 py-1 text-xs bg-white border border-outline-variant rounded-lg focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
              />
            </div>

            <button
              onClick={onRefresh}
              className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant"
              title="Refresh Queue"
            >
              <span className="material-symbols-outlined text-[18px]">sync</span>
            </button>
          </div>
        </header>

        {/* Action feedback alert banner */}
        {actionFeedback && (
          <div className="bg-primary px-4 py-2 text-white text-xs flex items-center justify-between shrink-0 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary-fixed text-sm">notifications</span>
              <span>{actionFeedback}</span>
            </div>
            <button
              onClick={() => setActionFeedback(null)}
              className="text-white/70 hover:text-white text-xs"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        )}

        {/* MAIN BODY AREA */}
        <main className="flex-1 flex overflow-hidden p-4 gap-4">
          {/* CENTER QUEUE CONTROL & ROSTER */}
          <section className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1 min-w-0">
            {/* HERO PATIENT ACTION PANEL */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-xs shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-outline-variant gap-3">
                {/* Patient ID & Token Display */}
                <div className="flex items-center gap-3">
                  <div className="px-3.5 py-1.5 bg-primary-container text-white rounded-lg shadow-xs text-center shrink-0">
                    <div className="text-[9px] uppercase text-primary-fixed tracking-wider font-mono">CURRENT TOKEN</div>
                    <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white">
                      {currentServing ? currentServing.token : 'None'}
                    </div>
                  </div>
                  <div>
                    {currentServing ? (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base sm:text-lg text-primary font-bold">{currentServing.fullName}</h2>
                          <span className="text-xs font-mono text-on-surface-variant bg-surface-container px-1.5 py-0.2 rounded">
                            {currentServing.age}, {currentServing.gender}
                          </span>
                          <span className="text-[10px] bg-secondary-container/40 text-on-secondary-container px-2 py-0.2 rounded font-semibold">
                            {currentServing.triageSeverity}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant mt-0.5">
                          <span>
                            ID: <strong className="font-mono text-primary">{currentServing.id}</strong>
                          </span>
                          <span>•</span>
                          <span className="truncate max-w-xs">
                            Chief Complaint: <strong className="text-on-surface">{currentServing.chiefComplaint}</strong>
                          </span>
                        </div>
                      </>
                    ) : (
                      <div>
                        <h2 className="text-base font-bold text-on-surface-variant">Desk Ready - No Active Patient</h2>
                        <p className="text-xs text-outline">Click "Call Next Patient" to admit the next waiting ticket.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Consultation Timer */}
                {currentServing && (
                  <div className="flex sm:flex-col items-center sm:items-end justify-between shrink-0">
                    <span className="text-[10px] text-on-surface-variant uppercase font-mono">Consultation Timer</span>
                    <div className="flex items-center gap-1 font-mono text-xl text-secondary font-bold">
                      <span className="material-symbols-outlined text-[18px] animate-pulse">timer</span>
                      <span>{formatTimer(consultationTimer)}</span>
                      <span className="text-xs font-normal text-on-surface-variant">elapsed</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Rapid Action Buttons */}
              <div className="flex flex-wrap items-center justify-between pt-3 gap-2">
                <div className="flex items-center gap-2">
                  {/* Complete Consultation */}
                  <button
                    onClick={handleComplete}
                    disabled={!currentServing || actionLoading}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-secondary text-white hover:bg-on-secondary-container rounded-lg text-xs font-bold shadow-xs transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    <span>Complete Consultation</span>
                  </button>

                  {/* Call Next Patient */}
                  <button
                    onClick={handleCallNext}
                    disabled={actionLoading || waitingPatients.length === 0}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-primary text-white hover:bg-primary-container rounded-lg text-xs font-bold shadow-xs transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <span className="material-symbols-outlined text-[18px]">volume_up</span>
                    <span>
                      {nextWaitingPatient ? `Call Next Patient (${nextWaitingPatient.token})` : 'Call Next (Queue Empty)'}
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* Hold / Sent to Lab */}
                  {currentServing && (
                    <button
                      onClick={() => handleHoldLab(currentServing.token)}
                      disabled={actionLoading}
                      className="flex items-center gap-1 px-3 py-1.5 border border-outline text-on-surface hover:bg-surface-container rounded-lg text-xs font-medium transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px] text-amber-700">biotech</span>
                      <span>Hold / Lab</span>
                    </button>
                  )}

                  {/* View Clinical Chart */}
                  {currentServing && (
                    <button
                      onClick={() => onViewPatientChart(currentServing)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-surface-container-high text-primary hover:bg-surface-container-highest rounded-lg text-xs font-semibold transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">medical_services</span>
                      <span>View Chart</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* OPD-WISE LIVE QUEUE TABLE */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-xs flex flex-col flex-1">
              {/* Table Header Controls */}
              <div className="px-4 py-2.5 border-b border-outline-variant flex items-center justify-between bg-surface-container-low shrink-0">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">format_list_bulleted</span>
                  <h3 className="font-bold text-xs text-primary">{selectedDept} Queue Roster</h3>
                  <span className="text-[10px] font-mono bg-surface-container-highest text-primary px-2 py-0.5 rounded-full font-bold">
                    {waitingPatients.length} Waiting
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[10px] font-mono text-on-surface-variant">Auto-sync: Active</span>
                  <button
                    onClick={onRefresh}
                    className="p-1 hover:bg-surface-container rounded text-on-surface-variant"
                    title="Refresh table"
                  >
                    <span className="material-symbols-outlined text-[16px]">sync</span>
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto flex-1">
                {filteredPatients.length === 0 ? (
                  <div className="p-8 text-center text-on-surface-variant flex flex-col items-center justify-center">
                    <span className="material-symbols-outlined text-3xl text-outline mb-2">fact_check</span>
                    <p className="text-sm font-semibold">No patients found in this queue</p>
                    <p className="text-xs text-outline mt-1">
                      {searchQuery ? 'Try clearing your search query.' : 'All patients have been served for this clinic.'}
                    </p>
                    <button
                      onClick={() => onNavigate('register')}
                      className="mt-3 px-3 py-1.5 bg-secondary text-white text-xs rounded-lg font-semibold hover:bg-on-secondary-container"
                    >
                      Register New Patient
                    </button>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-outline-variant bg-surface-container text-on-surface-variant font-mono text-[10px] uppercase">
                        <th className="py-2 px-3">Token #</th>
                        <th className="py-2 px-3">Patient Name</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Triage Severity</th>
                        <th className="py-2 px-3">Location</th>
                        <th className="py-2 px-3">Room</th>
                        <th className="py-2 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant font-sans">
                      {filteredPatients.map((patient) => {
                        const isThisServing = patient.status === 'SERVING';
                        return (
                          <tr
                            key={patient.id}
                            className={`hover:bg-surface-container-low transition-colors ${
                              isThisServing ? 'bg-secondary-container/15 font-medium' : 'bg-white'
                            }`}
                          >
                            <td className="py-2.5 px-3 font-mono text-xs font-bold text-primary">
                              {patient.token}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-primary">{patient.fullName}</div>
                              <div className="text-[10px] text-on-surface-variant font-mono">
                                {patient.age}, {patient.gender.charAt(0)} • {patient.id}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded font-mono text-[9px] font-bold uppercase ${
                                  patient.status === 'SERVING'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : patient.status === 'WAITING'
                                    ? 'bg-surface-container text-on-surface-variant'
                                    : patient.status === 'HOLD_LAB'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {patient.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center gap-1 font-mono text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                                  patient.triageSeverity === 'Urgent Priority'
                                    ? 'bg-red-100 text-red-900 border border-red-300'
                                    : patient.triageSeverity === 'Senior Priority'
                                    ? 'bg-indigo-100 text-indigo-900'
                                    : patient.triageSeverity === 'Pediatric Fast-Track'
                                    ? 'bg-purple-100 text-purple-900'
                                    : 'bg-surface-container-high text-on-surface-variant'
                                }`}
                              >
                                {patient.triageSeverity}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-[11px] text-on-surface">
                              {patient.location}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px]">
                              {patient.room}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="inline-flex items-center gap-1">
                                {patient.status === 'WAITING' && (
                                  <button
                                    onClick={() => handleCallSpecific(patient.token)}
                                    className="px-2 py-0.5 bg-secondary text-white rounded text-[11px] font-semibold hover:bg-on-secondary-container transition-all active:scale-95"
                                  >
                                    Call
                                  </button>
                                )}
                                <button
                                  onClick={() => onViewPatientChart(patient)}
                                  className="px-2 py-0.5 border border-outline-variant rounded text-[11px] text-primary hover:bg-surface-container transition-colors"
                                >
                                  Details
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </section>

          {/* RIGHT-HAND SUMMARY & ADJOINING SIDEBAR */}
          <aside className="w-72 shrink-0 hidden xl:flex flex-col gap-4">
            {/* Performance Cards */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-3.5 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-outline-variant mb-2">
                <h4 className="font-bold text-xs text-primary">OPD Suite Performance</h4>
                <span className="text-[10px] font-mono text-secondary font-semibold">TODAY</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-surface-container-low rounded border border-outline-variant">
                  <div className="text-[10px] text-on-surface-variant uppercase font-mono">Total Seen</div>
                  <div className="font-mono text-xl font-bold text-primary mt-0.5">
                    {deptData?.totalServedToday ?? 18}
                  </div>
                  <div className="text-[9px] text-secondary">Discharged</div>
                </div>
                <div className="p-2 bg-surface-container-low rounded border border-outline-variant">
                  <div className="text-[10px] text-on-surface-variant uppercase font-mono">In Waiting</div>
                  <div className="font-mono text-xl font-bold text-secondary mt-0.5">
                    {waitingPatients.length}
                  </div>
                  <div className="text-[9px] text-on-surface-variant">Avg: ~{deptData.averageWaitMinutes}m</div>
                </div>
                <div className="p-2 bg-surface-container-low rounded border border-outline-variant">
                  <div className="text-[10px] text-on-surface-variant uppercase font-mono">At Lab/X-Ray</div>
                  <div className="font-mono text-xl font-bold text-amber-700 mt-0.5">
                    {allDeptPatients.filter((p) => p.status === 'HOLD_LAB').length + 1}
                  </div>
                  <div className="text-[9px] text-on-surface-variant">Pending reports</div>
                </div>
                <div className="p-2 bg-surface-container-low rounded border border-outline-variant">
                  <div className="text-[10px] text-on-surface-variant uppercase font-mono">Velocity SLA</div>
                  <div className="font-mono text-xl font-bold text-primary mt-0.5">94%</div>
                  <div className="text-[9px] text-secondary">Within &lt;20m target</div>
                </div>
              </div>
            </div>

            {/* Quick Gate Scanner Launcher */}
            <div className="bg-primary-container text-white rounded-xl p-3.5 border border-outline-variant shadow-xs flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-block px-1.5 py-0.5 bg-secondary text-white rounded text-[9px] font-bold uppercase font-mono mb-1">
                    Gate Pass Unit
                  </span>
                  <h5 className="font-bold text-sm text-white">QR Token Validator</h5>
                  <p className="text-[11px] text-primary-fixed-dim mt-0.5">
                    Scan walk-in physical slips or digital hospital passes.
                  </p>
                </div>
                <span className="material-symbols-outlined text-secondary-container text-2xl">qr_code_scanner</span>
              </div>
              <div className="mt-3 pt-2 border-t border-primary/40 flex items-center justify-between">
                <span className="text-[10px] font-mono text-primary-fixed-dim">Scanner Ready</span>
                <button
                  onClick={onOpenScanner}
                  className="px-3 py-1 bg-secondary-fixed text-primary font-bold text-xs rounded-lg hover:bg-secondary-fixed-dim transition-colors"
                >
                  Open Scanner
                </button>
              </div>
            </div>

            {/* Adjoining Clinics */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-3.5 shadow-xs flex-1 flex flex-col">
              <div className="flex items-center justify-between pb-2 border-b border-outline-variant mb-2">
                <h5 className="font-bold text-xs text-primary">Adjoining Clinics Status</h5>
                <span className="material-symbols-outlined text-outline text-[16px]">dns</span>
              </div>
              <div className="space-y-2 flex-1 text-xs">
                {/* Cardiology */}
                <div
                  onClick={() => setSelectedDept('Cardiology')}
                  className={`p-2 rounded border transition-colors cursor-pointer ${
                    selectedDept === 'Cardiology'
                      ? 'border-secondary bg-secondary-container/20'
                      : 'bg-surface-container-low border-outline-variant hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-primary">Room 102 (Cardiology)</div>
                      <div className="text-[10px] text-on-surface-variant font-mono">
                        Now Serving: {queueState.departments['Cardiology']?.nowServingToken || 'Standby'}
                      </div>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-secondary"></span>
                  </div>
                </div>

                {/* Orthopaedics */}
                <div
                  onClick={() => setSelectedDept('Orthopaedics')}
                  className={`p-2 rounded border transition-colors cursor-pointer ${
                    selectedDept === 'Orthopaedics'
                      ? 'border-secondary bg-secondary-container/20'
                      : 'bg-surface-container-low border-outline-variant hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-primary">Room 105 (Orthopaedics)</div>
                      <div className="text-[10px] text-on-surface-variant font-mono">
                        Now Serving: {queueState.departments['Orthopaedics']?.nowServingToken || 'Standby'}
                      </div>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-secondary"></span>
                  </div>
                </div>

                {/* General Medicine */}
                <div
                  onClick={() => setSelectedDept('General Medicine')}
                  className={`p-2 rounded border transition-colors cursor-pointer ${
                    selectedDept === 'General Medicine'
                      ? 'border-secondary bg-secondary-container/20'
                      : 'bg-surface-container-low border-outline-variant hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-primary">Room 104 (General Medicine)</div>
                      <div className="text-[10px] text-on-surface-variant font-mono">
                        Now Serving: {queueState.departments['General Medicine']?.nowServingToken || 'Standby'}
                      </div>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-secondary"></span>
                  </div>
                </div>
              </div>
              <div className="mt-2 text-center text-[10px] text-outline font-mono">
                St. Jude Telemetry Mesh v4.8
              </div>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
};
