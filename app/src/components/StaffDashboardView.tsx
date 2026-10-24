import React, { useState, useEffect } from 'react';
import {
  staffCallNext,
  staffCompleteConsultation,
  staffHoldLab,
  staffCallToken,
  staffCancelQueuePatient,
  staffSetDoctorStatus,
  resetDemoData,
  verifyPass,
  fetchScanLogs,
  DEFAULT_SECURITY_TOKEN,
  StaffSession,
} from '../services/api';
import {
  OPDDepartment,
  PatientRecord,
  SmartQueueState,
  GateClearanceDTO,
  GateScanLogEntry,
  StaffRole,
} from '../types/queue';

interface StaffDashboardViewProps {
  queueState: SmartQueueState;
  staffRole?: 'clinical' | 'security';
  staffSession?: StaffSession | null;
  onLogout?: () => void;
  onToggleStaffRole?: (role: 'clinical' | 'security') => void;
  onRefresh: () => void;
  onNavigate: (view: 'home' | 'register' | 'patient' | 'staff' | 'analytics') => void;
  onOpenScanner: () => void;
  onViewPatientChart: (patient: PatientRecord) => void;
  onOpenPatientPass?: (patient: PatientRecord) => void;
}

export const StaffDashboardView: React.FC<StaffDashboardViewProps> = ({
  queueState,
  staffRole = 'clinical',
  staffSession,
  onLogout,
  onToggleStaffRole,
  onRefresh,
  onNavigate,
  onOpenScanner,
  onViewPatientChart,
  onOpenPatientPass,
}) => {
  const [activeRole, setActiveRole] = useState<'clinical' | 'security'>(staffRole);
  const [selectedDept, setSelectedDept] = useState<OPDDepartment>('General Medicine');
  const [searchQuery, setSearchQuery] = useState('');
  const [consultationTimer, setConsultationTimer] = useState<number>(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Security View States
  const [secInputCode, setSecInputCode] = useState('SQ-PASS-90412E5F6A7B8C9D0E1F-B');
  const [secScanning, setSecScanning] = useState(false);
  const [secBarrierReleased, setSecBarrierReleased] = useState(false);
  const [secClearance, setSecClearance] = useState<GateClearanceDTO | null>(null);
  const [secScanLogs, setSecScanLogs] = useState<GateScanLogEntry[]>([]);
  const [rbacTestStatus, setRbacTestStatus] = useState<string | null>(null);
  const [rbacTestLoading, setRbacTestLoading] = useState(false);

  // Sync prop changes
  useEffect(() => {
    setActiveRole(staffRole);
  }, [staffRole]);

  // Load audit logs on mount
  useEffect(() => {
    fetchScanLogs(staffSession?.token || DEFAULT_SECURITY_TOKEN)
      .then((logs) => setSecScanLogs(logs))
      .catch((err) => console.warn('Could not fetch initial scan logs:', err));
  }, [staffSession?.token]);

  // Derive active consultation fields safely for the timer hook
  const activeServing = queueState?.departments?.[selectedDept]?.nowServingPatient
    || queueState?.departments?.['General Medicine']?.nowServingPatient
    || null;
  const activeServingToken = activeServing?.token;
  const activeServingCalledAt = activeServing?.calledAt;

  // Live timer for active consultation - called unconditionally at top of component
  useEffect(() => {
    if (activeServingCalledAt) {
      const startMs = new Date(activeServingCalledAt).getTime();
      const initialSeconds = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      setConsultationTimer(initialSeconds);

      const interval = setInterval(() => {
        setConsultationTimer((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setConsultationTimer(0);
    }
  }, [activeServingToken, activeServingCalledAt]);

  const handleRoleToggle = (newRole: 'clinical' | 'security') => {
    if (staffSession && staffSession.user.role !== newRole) {
      setActionFeedback(
        `Authenticated as ${staffSession.user.name} (${staffSession.user.role.toUpperCase()}). Please sign out and log in with ${newRole} credentials to access that station.`
      );
      return;
    }
    setActiveRole(newRole);
    if (onToggleStaffRole) onToggleStaffRole(newRole);
  };

  const handleSecVerify = async (codeToVerify: string) => {
    if (!codeToVerify.trim()) return;
    setSecScanning(true);
    try {
      const res = await verifyPass(codeToVerify.trim(), staffSession?.token || DEFAULT_SECURITY_TOKEN, 'Gate 02');
      setSecClearance(res);
      const logs = await fetchScanLogs(staffSession?.token || DEFAULT_SECURITY_TOKEN);
      setSecScanLogs(logs);
    } catch (err: any) {
      setSecClearance({
        outcome: 'INVALID',
        message: err.message || 'Verification network request failed.',
        scanTimestamp: new Date().toISOString(),
      });
    } finally {
      setSecScanning(false);
    }
  };

  const handleReleaseBarrier = () => {
    setSecBarrierReleased(true);
    setTimeout(() => setSecBarrierReleased(false), 2500);
  };

  // Test Server-Side Least Privilege / RBAC
  const handleTestRbac = async () => {
    setRbacTestLoading(true);
    setRbacTestStatus(null);
    try {
      const res = await fetch('/api/staff/queue', {
        headers: { Authorization: `Bearer ${DEFAULT_SECURITY_TOKEN}` },
      });
      const data = await res.json();
      if (res.status === 403) {
        setRbacTestStatus(
          `✓ Server Enforced (HTTP 403 Forbidden): "${data.message || data.error}". Security credentials cannot access clinical EHR records.`
        );
      } else {
        setRbacTestStatus(`Unexpected server status: ${res.status}`);
      }
    } catch (err: any) {
      setRbacTestStatus(`Test error: ${err.message}`);
    } finally {
      setRbacTestLoading(false);
    }
  };

  if (!queueState) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center p-6 bg-background text-center">
        <div className="w-12 h-12 rounded-xl bg-primary-container flex items-center justify-center text-secondary-fixed mb-3 shadow-md animate-pulse">
          <span className="material-symbols-outlined text-3xl">stethoscope</span>
        </div>
        <h2 className="text-base font-bold text-primary font-mono">Connecting to Clinical Workstation...</h2>
        <p className="text-xs text-on-surface-variant mt-1 max-w-sm">
          Authenticating staff credentials and synchronizing real-time outpatient department rosters...
        </p>
        <button
          onClick={onRefresh}
          className="mt-4 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary-container transition-all flex items-center gap-1.5 shadow-xs"
        >
          <span className="material-symbols-outlined text-sm">sync</span>
          <span>Refresh Workstation</span>
        </button>
      </div>
    );
  }

  const fallbackRoom = selectedDept === 'Cardiology' ? 'Room 102' : selectedDept === 'Orthopaedics' ? 'Room 105' : 'Room 104';
  const deptData = queueState?.departments?.[selectedDept] || queueState?.departments?.['General Medicine'] || {
    department: selectedDept,
    displayName: selectedDept,
    room: fallbackRoom,
    suite: 'Suite A',
    doctor: 'Attending Physician',
    active: true,
    activeDesks: 1,
    nowServingToken: null,
    nowServingPatient: null,
    waitingCount: 0,
    totalServedToday: 18,
    averageWaitMinutes: 15,
  };
  const currentServing = deptData?.nowServingPatient || null;

  // Department waiting patients
  const allDeptPatients = (queueState?.patients || []).filter((p) => p.department === selectedDept);
  const waitingPatients = allDeptPatients.filter((p) => p.status === 'WAITING');
  const nextWaitingPatient = waitingPatients[0] || null;

  // Filter queue roster by search safely
  const filteredPatients = allDeptPatients.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const tokenMatch = p.token ? p.token.toLowerCase().includes(q) : false;
    const nameMatch = p.fullName ? p.fullName.toLowerCase().includes(q) : false;
    const idMatch = p.id ? p.id.toLowerCase().includes(q) : false;
    const mrnMatch = p.mrn ? p.mrn.toLowerCase().includes(q) : false;
    return tokenMatch || nameMatch || idMatch || mrnMatch;
  });

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

  const handleCancelPatient = async (token: string) => {
    setActionLoading(true);
    try {
      await staffCancelQueuePatient(token, 'Patient Absent / Cancelled by Staff');
      setActionFeedback(`Patient Ticket ${token} marked absent/cancelled.`);
      onRefresh();
    } catch (err: any) {
      console.error(err);
      setActionFeedback(err.message || 'Failed to cancel ticket');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleDoctorStatus = async () => {
    setActionLoading(true);
    const newAvail = !(deptData.doctorAvailable !== false && deptData.active);
    try {
      await staffSetDoctorStatus(selectedDept, newAvail);
      setActionFeedback(`${selectedDept} Doctor marked ${newAvail ? 'AVAILABLE' : 'UNAVAILABLE'}.`);
      onRefresh();
    } catch (err: any) {
      console.error(err);
      setActionFeedback(err.message || 'Failed to update doctor status');
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
            {/* Live OPD Queues (Clinical view) */}
            <button
              type="button"
              onClick={() => handleRoleToggle('clinical')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors text-left ${
                activeRole === 'clinical'
                  ? 'bg-surface-container-high text-secondary border-l-4 border-secondary'
                  : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">stethoscope</span>
                <span>Doctor Workstation</span>
              </div>
              <span className="text-[10px] font-mono bg-secondary text-white px-1.5 py-0.2 rounded-full">
                {waitingPatients.length}
              </span>
            </button>

            {/* Gate Security Terminal */}
            <button
              type="button"
              onClick={() => handleRoleToggle('security')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors text-left ${
                activeRole === 'security'
                  ? 'bg-amber-100 text-amber-900 border-l-4 border-amber-600'
                  : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">shield</span>
                <span>Gate Security Kiosk</span>
              </div>
              <span className="text-[10px] font-mono bg-amber-600 text-white px-1.5 py-0.2 rounded-full">
                SEC
              </span>
            </button>

            {/* Gate Pass Scanner Modal */}
            <button
              type="button"
              onClick={onOpenScanner}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors text-xs text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
              <span className="font-semibold">Gate Scanner Terminal</span>
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

        {/* Staff Role Switcher & Profile Widget */}
        <div className="p-2 border-t border-outline-variant bg-surface-container-lowest space-y-2">
          <div className="p-2 rounded-lg bg-surface-container-low flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 text-white ${
                  activeRole === 'clinical' ? 'bg-primary' : 'bg-amber-700'
                }`}
              >
                {activeRole === 'clinical' ? 'SJ' : 'TB'}
              </div>
              <div className="overflow-hidden">
                <div className="text-xs text-primary font-bold truncate">
                  {activeRole === 'clinical' ? 'Dr. Sarah Jenkins' : 'Officer T. Briggs'}
                </div>
                <div className="flex items-center gap-1 text-[9px] text-secondary font-semibold font-mono truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
                  {activeRole === 'clinical' ? 'Suite B • Physician' : 'Gate 02 • Security'}
                </div>
              </div>
            </div>
            <button
              onClick={onLogout || (() => onNavigate('home'))}
              className="text-on-surface-variant hover:text-error transition-colors p-1 rounded shrink-0"
              title={onLogout ? 'Logout Staff Session' : 'Return to Landing'}
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
            </button>
          </div>
          {/* Quick toggle button */}
          <button
            type="button"
            onClick={() => handleRoleToggle(activeRole === 'clinical' ? 'security' : 'clinical')}
            className="w-full py-1.5 px-2 bg-surface-container hover:bg-surface-container-high rounded text-[11px] font-semibold text-primary flex items-center justify-center gap-1 transition-colors border border-outline-variant"
          >
            <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
            <span>Switch to {activeRole === 'clinical' ? 'Security Guard' : 'Doctor Workstation'}</span>
          </button>
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

            {/* Role indicator & Toggle */}
            <div className="flex items-center gap-1 bg-surface-container p-1 rounded-lg border border-outline-variant">
              <button
                type="button"
                onClick={() => handleRoleToggle('clinical')}
                className={`px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all ${
                  activeRole === 'clinical'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">stethoscope</span>
                <span>Doctor Workstation</span>
              </button>
              <button
                type="button"
                onClick={() => handleRoleToggle('security')}
                className={`px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all ${
                  activeRole === 'security'
                    ? 'bg-amber-700 text-white shadow-xs'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">shield</span>
                <span>Security Terminal</span>
              </button>
            </div>

            {/* Department Selector (When in clinical mode) */}
            {activeRole === 'clinical' && (
              <div className="flex items-center gap-1.5 sm:gap-2 bg-surface-container-low px-2 sm:px-2.5 py-1 rounded-lg border border-outline-variant">
                <span className="material-symbols-outlined text-secondary text-[16px]">meeting_room</span>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value as OPDDepartment)}
                  className="bg-transparent border-none text-xs font-bold text-primary focus:outline-none cursor-pointer pr-1 max-w-[120px] sm:max-w-none truncate"
                  aria-label="Select Outpatient Department"
                >
                  <option value="General Medicine">General Medicine (Room 104)</option>
                  <option value="Cardiology">Cardiology (Room 102)</option>
                  <option value="Orthopaedics">Orthopaedics (Room 105)</option>
                </select>
              </div>
            )}
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-2">
            {activeRole === 'clinical' && (
              <div className="relative w-40 sm:w-56 hidden md:block">
                <span className="material-symbols-outlined absolute left-2 top-2 text-[16px] text-outline">search</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Token #, Name, ID..."
                  className="w-full pl-7 pr-3 py-1 text-xs bg-white border border-outline-variant rounded-lg focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
                />
              </div>
            )}

            {staffSession && (
              <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container border border-outline-variant/70 text-[11px] font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="font-semibold text-primary">{staffSession.user.name}</span>
                <span className="text-on-surface-variant">({staffSession.user.operatorId})</span>
              </div>
            )}

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-surface-container hover:bg-surface-container-high text-primary border border-outline-variant flex items-center gap-1 transition-colors"
                title="Logout Staff Session"
              >
                <span className="material-symbols-outlined text-[15px] text-error">logout</span>
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}

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
        {activeRole === 'security' ? (
          <main className="flex-1 flex flex-col overflow-y-auto p-4 gap-4">
            {/* Least Privilege Zero-Knowledge Banner */}
            <div className="bg-amber-50 border-l-4 border-amber-600 border border-amber-200 rounded-xl p-3.5 shadow-xs">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-amber-700 text-2xl shrink-0 mt-0.5">shield</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-xs sm:text-sm text-amber-950">Security Gate Terminal — Least-Privilege Role Enforced</h3>
                    <span className="text-[10px] font-mono bg-amber-200 text-amber-900 px-2 py-0.2 rounded font-bold">SEC-402</span>
                  </div>
                  <p className="text-xs text-amber-900/90 mt-1 leading-relaxed">
                    For patient privacy and HIPAA compliance, security personnel are restricted from viewing full medical charts, clinical complaints, allergies, and EHR diagnoses. Gate clearances provide masked patient identities and clinic routing destinations only.
                  </p>
                </div>
              </div>
            </div>

            {/* Integrated Gate Scanner & Clearance Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Scanner Console (7 cols) */}
              <div className="lg:col-span-7 bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-outline-variant">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-lg">qr_code_scanner</span>
                    <h4 className="font-bold text-xs sm:text-sm text-primary">Gate 02 Terminal • Pass Validator</h4>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenScanner}
                    className="px-2.5 py-1 bg-secondary hover:bg-on-secondary-container text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-all shadow-xs"
                    title="Launch Optical Video Camera Scanner"
                  >
                    <span className="material-symbols-outlined text-[15px]">photo_camera</span>
                    <span>Launch Camera Scanner</span>
                  </button>
                </div>

                {/* Scan Input & Actions */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSecVerify(secInputCode);
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={secInputCode}
                    onChange={(e) => setSecInputCode(e.target.value)}
                    placeholder="Scan QR or enter token (e.g. SQ-PASS-90412... or MED-042)"
                    className="flex-1 h-10 px-3 bg-white border border-outline-variant rounded-lg text-primary text-xs font-mono uppercase focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
                  />
                  <button
                    type="button"
                    onClick={onOpenScanner}
                    className="h-10 px-3 bg-surface-container hover:bg-surface-container-high border border-outline-variant text-primary rounded-lg text-xs font-semibold flex items-center gap-1 transition-all shadow-xs"
                    title="Open Live Camera Scanner"
                  >
                    <span className="material-symbols-outlined text-[16px] text-secondary">photo_camera</span>
                    <span className="hidden sm:inline">Camera</span>
                  </button>
                  <button
                    type="submit"
                    disabled={secScanning}
                    className="h-10 px-4 bg-primary hover:bg-primary-container text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[16px]">verified</span>
                    <span>{secScanning ? 'Verifying...' : 'Verify Pass'}</span>
                  </button>
                </form>

                {/* Quick Test Fixture Buttons */}
                <div>
                  <span className="text-[10px] font-mono uppercase text-outline tracking-wider font-semibold block mb-1.5">
                    Synthetic Test Fixtures (Genuine Server Verification):
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px] font-mono">
                    <button
                      type="button"
                      onClick={() => {
                        setSecInputCode('SQ-PASS-90412E5F6A7B8C9D0E1F-B');
                        handleSecVerify('SQ-PASS-90412E5F6A7B8C9D0E1F-B');
                      }}
                      className="py-1.5 px-2 rounded bg-secondary-container/30 border border-secondary text-secondary font-semibold hover:bg-secondary-container transition-colors"
                    >
                      Valid Pass
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSecInputCode('SQ-PASS-EXPIRED-TEST-FIXTURE-B');
                        handleSecVerify('SQ-PASS-EXPIRED-TEST-FIXTURE-B');
                      }}
                      className="py-1.5 px-2 rounded bg-amber-50 border border-amber-300 text-amber-800 font-semibold hover:bg-amber-100 transition-colors"
                    >
                      Expired (35d)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSecInputCode('SQ-PASS-REVOKED-TEST-FIXTURE-B');
                        handleSecVerify('SQ-PASS-REVOKED-TEST-FIXTURE-B');
                      }}
                      className="py-1.5 px-2 rounded bg-red-50 border border-red-300 text-error font-semibold hover:bg-red-100 transition-colors"
                    >
                      Revoked Pass
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSecInputCode('SQ-UNKNOWN-QR-999');
                        handleSecVerify('SQ-UNKNOWN-QR-999');
                      }}
                      className="py-1.5 px-2 rounded bg-surface-container border border-outline-variant text-on-surface hover:bg-surface-container-high transition-colors"
                    >
                      Unknown Code
                    </button>
                  </div>
                </div>

                {!secClearance && (
                  <div className="pt-2">
                    <div className="p-4 rounded-xl border border-dashed border-outline-variant text-center bg-surface-container-low/40 space-y-1">
                      <span className="material-symbols-outlined text-2xl text-secondary">verified_user</span>
                      <p className="text-xs font-semibold text-primary">Security Gate Ready for Validation</p>
                      <p className="text-[11px] text-on-surface-variant max-w-sm mx-auto">
                        Enter any patient's opaque pass identifier, scan a badge, or select a synthetic test fixture to execute server authorization.
                      </p>
                    </div>
                  </div>
                )}

                {/* Clearance Outcome Display */}
                {secClearance && (
                  <div className="pt-2">
                    {secClearance.isDuplicateScan && (
                      <div className="p-2.5 rounded-lg bg-amber-50 border-l-4 border-amber-600 border border-amber-200 mb-2">
                        <div className="flex items-start gap-2">
                          <span className="material-symbols-outlined text-amber-700 text-[18px] shrink-0 mt-0.5">warning</span>
                          <div>
                            <span className="text-xs font-bold text-amber-900 block">Duplicate Scan Notification</span>
                            <p className="text-[11px] text-amber-800 leading-tight mt-0.5">
                              {secClearance.duplicateWarning || 'Pass scanned again within cooldown window.'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {secClearance.outcome === 'VALID' && (
                      <div className="relative bg-surface-container-lowest border-2 border-secondary rounded-xl overflow-hidden p-3 pl-4 shadow-xs">
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-secondary"></div>
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-outline-variant">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-secondary text-[20px]">check_circle</span>
                            <div>
                              <span className="text-xs font-bold text-secondary uppercase tracking-wide block">ACCESS GRANTED</span>
                              <span className="text-[10px] font-mono text-on-surface-variant">Clearance: {secClearance.clearanceLevel || 'Tier-1 Ambulatory'}</span>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-secondary-container/40 text-on-secondary-container font-mono text-[10px] font-bold">
                            VALID PASS
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                          <div>
                            <span className="text-[9px] uppercase text-on-surface-variant block font-medium">Authorized Visitor</span>
                            <p className="font-bold text-primary truncate">{secClearance.patientNameMasked || 'Authorized Visitor'}</p>
                            <span className="text-[10px] font-mono text-outline">Token: <strong className="text-secondary">{secClearance.token}</strong></span>
                          </div>
                          <div>
                            <span className="text-[9px] uppercase text-on-surface-variant block font-medium">Designated Clinic</span>
                            <p className="font-semibold text-primary truncate">{secClearance.department}</p>
                            <span className="text-[10px] font-mono text-secondary font-bold">{secClearance.room}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-outline-variant">
                          <span className="text-[11px] font-mono text-on-surface-variant">Validated at Gate 02 Terminal</span>
                          <button
                            onClick={handleReleaseBarrier}
                            className={`px-3 py-1 rounded text-xs font-semibold transition-all flex items-center gap-1 shadow-xs ${
                              secBarrierReleased ? 'bg-emerald-600 text-white' : 'bg-secondary text-white hover:bg-on-secondary-container'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[14px]">door_open</span>
                            <span>{secBarrierReleased ? 'Barrier Released (Signal Sent)' : 'Release Entry Barrier'}</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {secClearance.outcome === 'EXPIRED' && (
                      <div className="relative bg-surface-container-lowest border-2 border-amber-600 rounded-xl overflow-hidden p-3 pl-4 shadow-xs">
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-600"></div>
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-outline-variant">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-amber-700 text-[20px]">history_toggle_off</span>
                            <span className="text-xs font-bold text-amber-800 uppercase tracking-wide block">EXPIRED PASS - ACCESS DENIED</span>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-mono text-[10px] font-bold">EXPIRED</span>
                        </div>
                        <p className="text-xs text-on-surface-variant">{secClearance.message}</p>
                      </div>
                    )}

                    {secClearance.outcome === 'REVOKED' && (
                      <div className="relative bg-surface-container-lowest border-2 border-error rounded-xl overflow-hidden p-3 pl-4 shadow-xs">
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-error"></div>
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-red-200">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-error text-[20px]">gavel</span>
                            <span className="text-xs font-bold text-error uppercase tracking-wide block">SECURITY HOLD - ENTRY SUSPENDED</span>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-error text-white font-mono text-[10px] font-bold">REVOKED</span>
                        </div>
                        <p className="text-xs text-on-surface-variant">{secClearance.message}</p>
                      </div>
                    )}

                    {secClearance.outcome === 'INVALID' && (
                      <div className="relative bg-surface-container-lowest border-2 border-outline-variant rounded-xl overflow-hidden p-3 pl-4 shadow-xs">
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-outline"></div>
                        <div className="flex items-center justify-between pb-2 mb-1">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-outline text-[20px]">qr_code_2</span>
                            <span className="text-xs font-bold text-primary uppercase tracking-wide block">INVALID PASS SIGNATURE</span>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-mono text-[10px] font-bold">INVALID</span>
                        </div>
                        <p className="text-xs text-on-surface-variant">{secClearance.message}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Security RBAC Verification & Persistent Audit Log (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                {/* Live RBAC Verification Card */}
                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-3.5 shadow-xs space-y-2.5">
                  <div className="flex items-center justify-between pb-1.5 border-b border-outline-variant">
                    <h4 className="font-bold text-xs text-primary flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-amber-700">lock_person</span>
                      Server-Side RBAC Enforcement
                    </h4>
                    <span className="text-[10px] font-mono text-outline">HTTP 403 Test</span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    Verify that Security credentials cannot access protected Clinical EHR queues (<code className="font-mono text-primary bg-surface-container px-1 py-0.5 rounded">/api/staff/queue</code>).
                  </p>
                  <button
                    onClick={handleTestRbac}
                    disabled={rbacTestLoading}
                    className="w-full py-1.5 px-3 bg-primary hover:bg-primary-container text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[15px]">send</span>
                    <span>{rbacTestLoading ? 'Sending HTTP Request...' : 'Test RBAC: Query /api/staff/queue'}</span>
                  </button>
                  {rbacTestStatus && (
                    <div className="p-2.5 rounded bg-surface-container-low border border-outline-variant text-[11px] text-primary font-mono leading-relaxed">
                      {rbacTestStatus}
                    </div>
                  )}
                </div>

                {/* Gate Scan Audit Log */}
                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-3.5 shadow-xs flex flex-col">
                  <div className="flex items-center justify-between pb-2 border-b border-outline-variant mb-2">
                    <h4 className="font-bold text-xs text-primary flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                      Persistent Scan Log (gate_scans.json)
                    </h4>
                    <span className="text-[10px] font-mono text-secondary font-semibold">SEC-402</span>
                  </div>
                  <ul className="space-y-1.5 text-xs font-mono max-h-56 overflow-y-auto pr-1">
                    {secScanLogs.length === 0 ? (
                      <li className="text-[11px] text-on-surface-variant py-2 text-center">No scans recorded yet.</li>
                    ) : (
                      secScanLogs.slice(0, 10).map((log) => (
                        <li key={log.id} className="p-1.5 rounded bg-surface-container-low border border-outline-variant/60 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 truncate max-w-[65%]">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${log.outcome === 'VALID' ? 'bg-secondary' : log.outcome === 'EXPIRED' ? 'bg-amber-600' : 'bg-error'}`}></span>
                            <span className="font-bold text-primary truncate">{log.token || log.passIdOrCode.substring(0, 14)}</span>
                            {log.patientNameMasked && <span className="text-on-surface-variant text-[10px] truncate">({log.patientNameMasked})</span>}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] shrink-0">
                            <span className={`px-1 py-0.2 rounded font-bold uppercase text-[9px] ${log.outcome === 'VALID' ? 'bg-secondary-container/40 text-on-secondary-container' : 'bg-error-container text-error'}`}>{log.outcome}</span>
                            <span className="text-outline text-[9px]">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </main>
        ) : (
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
                  <button
                    onClick={handleToggleDoctorStatus}
                    disabled={actionLoading}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold flex items-center gap-1 border transition-colors ${
                      deptData.doctorAvailable !== false && deptData.active
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                        : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                    }`}
                    title="Toggle Doctor Availability (Dynamic ETA recalculation)"
                  >
                    <span className="material-symbols-outlined text-[13px]">
                      {deptData.doctorAvailable !== false && deptData.active ? 'check_circle' : 'do_not_disturb_on'}
                    </span>
                    <span>{deptData.doctorAvailable !== false && deptData.active ? 'Doctor Online' : 'Doctor Offline'}</span>
                  </button>
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
                        <th className="py-2 px-3">Est. Wait</th>
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
                              <div className="font-semibold text-primary">{patient.fullName || `Patient (${patient.token})`}</div>
                              <div className="text-[10px] text-on-surface-variant font-mono">
                                {patient.age ? `${patient.age}, ` : ''}{patient.gender ? `${patient.gender.charAt(0)} • ` : ''}{patient.id}
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
                            <td className="py-2.5 px-3 font-mono text-[11px]">
                              {patient.status === 'WAITING' ? (
                                patient.etaUnavailable ? (
                                  <span
                                    className="text-amber-800 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200"
                                    title={patient.etaReason || 'Doctor Offline'}
                                  >
                                    Offline
                                  </span>
                                ) : patient.estimatedWaitMinutes === 0 ? (
                                  <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                                    Next (~0m)
                                  </span>
                                ) : (
                                  <span className="text-primary font-bold">
                                    ~{patient.estimatedWaitMinutes}m
                                  </span>
                                )
                              ) : patient.status === 'SERVING' ? (
                                <span className="text-emerald-700 font-semibold">Active</span>
                              ) : (
                                <span className="text-outline">—</span>
                              )}
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
                                  <>
                                    <button
                                      onClick={() => handleCallSpecific(patient.token)}
                                      className="px-2 py-0.5 bg-secondary text-white rounded text-[11px] font-semibold hover:bg-on-secondary-container transition-all active:scale-95"
                                    >
                                      Call
                                    </button>
                                    <button
                                      onClick={() => handleCancelPatient(patient.token)}
                                      className="px-1.5 py-0.5 border border-outline-variant hover:bg-red-50 hover:text-red-700 hover:border-red-300 rounded text-[10px] text-outline transition-colors"
                                      title="Mark Absent / Cancel Patient"
                                    >
                                      Absent
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => onViewPatientChart(patient)}
                                  className="px-2 py-0.5 border border-outline-variant rounded text-[11px] text-primary hover:bg-surface-container transition-colors"
                                >
                                  Details
                                </button>
                                {onOpenPatientPass && (
                                  <button
                                    onClick={() => onOpenPatientPass(patient)}
                                    className="px-2 py-0.5 bg-secondary-container/40 text-secondary border border-secondary/30 rounded text-[11px] font-semibold hover:bg-secondary-container transition-colors flex items-center gap-0.5"
                                    title="View 30-Day Digital QR Pass"
                                  >
                                    <span className="material-symbols-outlined text-[13px]">qr_code_2</span>
                                    <span>Pass</span>
                                  </button>
                                )}
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
                  <div className="text-[9px] text-on-surface-variant">Avg: ~{deptData?.averageWaitMinutes ?? 15}m</div>
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
        )}
      </div>
    </div>
  );
};
