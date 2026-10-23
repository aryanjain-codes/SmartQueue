import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchQueueState, fetchClinicalQueueState, lookupTokenOrPatient } from './services/api';
import { PatientQueueView, PatientRecord, PublicQueueStateDTO, SmartQueueState } from './types/queue';
import { HomeView } from './components/HomeView';
import { RegisterView } from './components/RegisterView';
import { PatientLiveView } from './components/PatientLiveView';
import { StaffDashboardView } from './components/StaffDashboardView';
import { AnalyticsView } from './components/AnalyticsView';
import { PatientPassModal } from './components/PatientPassModal';
import { GateScannerModal } from './components/GateScannerModal';
import { PatientChartModal } from './components/PatientChartModal';
import { TokenLookupModal } from './components/TokenLookupModal';
import { GlobalViewSwitcher } from './components/GlobalViewSwitcher';
import { ErrorBoundary } from './components/ErrorBoundary';

type ViewMode = 'home' | 'register' | 'patient' | 'staff' | 'analytics';

function getInitialView(): ViewMode {
  if (typeof window !== 'undefined') {
    const cleanPath = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    const firstSegment = cleanPath.split('/')[0];
    if (['home', 'register', 'patient', 'staff', 'analytics'].includes(firstSegment)) {
      return firstSegment as ViewMode;
    }
  }
  return 'home';
}

function getInitialPatientToken(): string | null {
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const qToken = urlParams.get('token') || urlParams.get('ticket') || urlParams.get('pass');
    if (qToken) return qToken.trim().toUpperCase();

    const match = window.location.pathname.match(/\/patient\/([A-Za-z0-9-_]+)/i);
    if (match && match[1]) return match[1].trim().toUpperCase();

    const saved = localStorage.getItem('smartqueue_active_token');
    if (saved) return saved.trim().toUpperCase();
  }
  return null;
}

export default function App() {
  const [currentView, setCurrentView] = useState<ViewMode>(getInitialView);
  const [staffRole, setStaffRole] = useState<'clinical' | 'security'>('clinical');
  const [registrationSuccess, setRegistrationSuccess] = useState<string | null>(null);
  const [publicQueueState, setPublicQueueState] = useState<PublicQueueStateDTO | null>(null);
  const [clinicalQueueState, setClinicalQueueState] = useState<SmartQueueState | null>(null);
  const [currentPatient, setCurrentPatient] = useState<PatientQueueView | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Active patient token tracker - stores current patient without hardcoding to demo patient
  const activeTokenRef = useRef<string | null>(getInitialPatientToken());

  // Patient view lookup input state
  const [patientLookupInput, setPatientLookupInput] = useState('');
  const [patientLookupLoading, setPatientLookupLoading] = useState(false);
  const [patientLookupError, setPatientLookupError] = useState<string | null>(null);

  // Modals
  const [passModalOpen, setPassModalOpen] = useState(false);
  const [scannerModalOpen, setScannerModalOpen] = useState(false);
  const [scannerModalCode, setScannerModalCode] = useState<string>('');
  const [lookupModalOpen, setLookupModalOpen] = useState(false);
  const [chartModalPatient, setChartModalPatient] = useState<PatientRecord | null>(null);

  // Unified Gate Scanner opener and closer
  const handleOpenGateScanner = useCallback((initialCode?: string) => {
    const code = initialCode || scannerModalCode || currentPatient?.passId || activeTokenRef.current || '';
    setScannerModalCode(code);
    setScannerModalOpen(true);
  }, [scannerModalCode, currentPatient?.passId]);

  const handleCloseGateScanner = useCallback(() => {
    setScannerModalOpen(false);
  }, []);

  // Update active patient state and persist selection
  const updateCurrentPatient = useCallback((patient: PatientQueueView | null) => {
    setCurrentPatient(patient);
    if (patient) {
      activeTokenRef.current = patient.token;
      if (typeof window !== 'undefined') {
        localStorage.setItem('smartqueue_active_token', patient.token);
      }
    }
  }, []);

  // Sync navigation view and optional token with browser history
  const navigateTo = useCallback((view: ViewMode, tokenParam?: string) => {
    setCurrentView(view);
    if (typeof window !== 'undefined') {
      let targetPath = view === 'home' ? '/' : `/${view}`;
      if (tokenParam) {
        targetPath += `?token=${encodeURIComponent(tokenParam)}`;
        activeTokenRef.current = tokenParam;
        localStorage.setItem('smartqueue_active_token', tokenParam);
      }
      if (window.location.pathname + window.location.search !== targetPath) {
        window.history.pushState(null, '', targetPath);
      }
    }
  }, []);

  // Listen for browser back / forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const cleanPath = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
      const firstSegment = cleanPath.split('/')[0];
      if (['home', 'register', 'patient', 'staff', 'analytics'].includes(firstSegment)) {
        setCurrentView(firstSegment as ViewMode);
      } else {
        setCurrentView('home');
      }

      // Check URL params for token
      const urlParams = new URLSearchParams(window.location.search);
      const qToken = urlParams.get('token');
      if (qToken) {
        activeTokenRef.current = qToken.trim().toUpperCase();
        lookupTokenOrPatient(qToken.trim().toUpperCase())
          .then((p) => setCurrentPatient(p))
          .catch(() => {});
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Synchronize queue state from backend (public or clinical based on view)
  const syncQueue = useCallback(async (tokenOverride?: string) => {
    setIsSyncing(true);
    try {
      // 1. Always fetch public queue state
      const pubState = await fetchQueueState();
      setPublicQueueState(pubState);
      setSyncError(null);

      // 2. If in staff view, fetch protected clinical queue state using clinical staff credentials
      if (currentView === 'staff') {
        try {
          const clinState = await fetchClinicalQueueState();
          setClinicalQueueState(clinState);
        } catch (cErr) {
          console.warn('Clinical sync error:', cErr);
        }
      }

      // 3. If we have an active patient token, refresh their telemetry without hardcoding to demo patient
      const targetToken = tokenOverride || activeTokenRef.current;
      if (targetToken) {
        try {
          const pView = await lookupTokenOrPatient(targetToken);
          setCurrentPatient(pView);
        } catch (err) {
          console.warn(`Could not sync patient token ${targetToken}:`, err);
        }
      }
    } catch (err: any) {
      console.error('Failed to sync queue state:', err);
      setSyncError(err?.message || 'Failed to connect to SmartQueue server');
    } finally {
      setIsSyncing(false);
      setInitialLoading(false);
    }
  }, [currentView]);

  // Initial fetch and auto-polling every 4 seconds to maintain synchronized real-time state across clients
  useEffect(() => {
    syncQueue();
    const interval = setInterval(() => {
      syncQueue();
    }, 4000);
    return () => clearInterval(interval);
  }, [syncQueue]);

  // When switching views, if entering staff view, immediately fetch clinical state
  useEffect(() => {
    if (currentView === 'staff') {
      fetchClinicalQueueState()
        .then((s) => setClinicalQueueState(s))
        .catch((err) => console.error('Failed to load clinical state for staff view:', err));
    }
  }, [currentView]);

  const handleRegistered = (newPatient: PatientQueueView) => {
    updateCurrentPatient(newPatient);
    setRegistrationSuccess(
      `Visit Token ${newPatient.token} successfully created for ${newPatient.fullName}. Estimated wait: ~${newPatient.estimatedWaitMinutes} mins.`
    );
    navigateTo('patient', newPatient.token);
    syncQueue(newPatient.token);
  };

  const handlePatientFound = (found: PatientQueueView) => {
    updateCurrentPatient(found);
    setRegistrationSuccess(null);
    navigateTo('patient', found.token);
  };

  const handleDirectTokenLookup = async (tokenOrId: string) => {
    if (!tokenOrId.trim()) return;
    setPatientLookupLoading(true);
    setPatientLookupError(null);
    try {
      const found = await lookupTokenOrPatient(tokenOrId.trim());
      handlePatientFound(found);
      setPatientLookupInput('');
    } catch (err: any) {
      setPatientLookupError(err?.message || `No active record found for "${tokenOrId}".`);
    } finally {
      setPatientLookupLoading(false);
    }
  };

  const activeQueueState = clinicalQueueState || publicQueueState;

  // Initial Loading Screen
  if (initialLoading && !activeQueueState) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-xl bg-primary-container flex items-center justify-center text-secondary-fixed mb-3 shadow-md animate-pulse">
          <span className="material-symbols-outlined text-3xl">local_hospital</span>
        </div>
        <h2 className="text-base font-bold text-primary font-mono">Initializing SmartQueue OPD Engine...</h2>
        <p className="text-xs text-on-surface-variant mt-1">Connecting to clinical triage & queue database...</p>
      </div>
    );
  }

  // Connection Error Screen (Prevents infinite blank or loading state)
  if (!activeQueueState && syncError) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant p-6 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shadow-xs">
            <span className="material-symbols-outlined text-3xl">cloud_off</span>
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-primary tracking-tight">Backend Connection Required</h2>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              SmartQueue OPD could not establish a connection to the local API service.
            </p>
          </div>
          <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant/60 font-mono text-[11px] text-primary text-left">
            Error: {syncError}
          </div>
          <button
            type="button"
            onClick={() => {
              setInitialLoading(true);
              syncQueue();
            }}
            className="w-full py-2.5 px-4 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary-container transition-all shadow-xs flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            <span>Retry Connection</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col antialiased selection:bg-secondary-container selection:text-on-secondary-container">
      {/* Top Universal View Switcher */}
      <GlobalViewSwitcher
        currentView={currentView}
        staffRole={staffRole}
        onNavigate={navigateTo}
        onSelectStaffRole={(role) => setStaffRole(role)}
        onOpenScanner={() => handleOpenGateScanner()}
        patientToken={currentPatient?.token}
        isSyncing={isSyncing}
      />

      {/* Main View Router */}
      <div className="flex-1 flex flex-col">
        <ErrorBoundary fallbackTitle="SmartQueue View Error">
          {currentView === 'home' && (
            <HomeView
              queueState={publicQueueState}
              onNavigate={navigateTo}
              onLookupToken={() => setLookupModalOpen(true)}
              onOpenScanner={() => handleOpenGateScanner()}
            />
          )}

          {currentView === 'register' && (
            <RegisterView
              queueState={publicQueueState}
              onRegistered={handleRegistered}
              onNavigate={navigateTo}
              onLookupToken={() => setLookupModalOpen(true)}
            />
          )}

          {currentView === 'patient' && (
            currentPatient ? (
              <PatientLiveView
                patientView={currentPatient}
                queueState={publicQueueState}
                successMessage={registrationSuccess}
                onDismissSuccess={() => setRegistrationSuccess(null)}
                onRefresh={() => syncQueue(currentPatient.token)}
                onNavigate={navigateTo}
                onOpenPass={() => setPassModalOpen(true)}
                onLookupToken={() => setLookupModalOpen(true)}
                onOpenScanner={() => handleOpenGateScanner(currentPatient.passId)}
              />
            ) : (
              /* Patient Empty & Lookup Recovery View (Prevents Blank Screen) */
              <div className="max-w-md mx-auto w-full min-h-screen bg-surface-container-lowest flex flex-col relative pb-20 shadow-sm">
                <header className="bg-surface-container-lowest sticky top-0 z-40 w-full shadow-xs border-b border-outline-variant/30">
                  <div className="flex justify-between items-center w-full px-4 h-14">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center text-secondary-fixed">
                        <span className="material-symbols-outlined text-[20px]">smartphone</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-base text-primary tracking-tight leading-none">Patient Queue App</span>
                        <span className="text-[10px] text-on-surface-variant font-medium mt-0.5">St. Jude Memorial Hospital</span>
                      </div>
                    </div>
                    <button
                      onClick={() => navigateTo('home')}
                      className="text-on-surface-variant hover:text-primary p-1.5 rounded-full hover:bg-surface-container transition-colors"
                      title="Home"
                    >
                      <span className="material-symbols-outlined text-xl">home</span>
                    </button>
                  </div>
                </header>

                <main className="flex-1 px-4 py-6 flex flex-col gap-5">
                  <div className="text-center space-y-1.5 pt-2">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-secondary-container/30 border border-secondary text-secondary flex items-center justify-center shadow-xs">
                      <span className="material-symbols-outlined text-3xl">badge</span>
                    </div>
                    <h2 className="text-lg font-bold text-primary tracking-tight">Active Visit Token Required</h2>
                    <p className="text-xs text-on-surface-variant max-w-xs mx-auto leading-relaxed">
                      Select or search for an active patient visit token to track live consultation queue progress, estimated wait times, and QR gate clearance.
                    </p>
                  </div>

                  {patientLookupError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-900 rounded-lg text-xs flex items-start gap-2">
                      <span className="material-symbols-outlined text-red-600 text-sm mt-0.5">error</span>
                      <span>{patientLookupError}</span>
                    </div>
                  )}

                  {/* Token Search Box */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleDirectTokenLookup(patientLookupInput);
                    }}
                    className="space-y-2 bg-surface-container-low p-4 rounded-xl border border-outline-variant/60"
                  >
                    <label className="block text-xs font-semibold text-primary">
                      Search OPD Token or Patient ID
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={patientLookupInput}
                        onChange={(e) => setPatientLookupInput(e.target.value)}
                        placeholder="e.g. MED-042 or SJH-2025-8841"
                        className="flex-1 h-10 px-3 bg-white border border-outline-variant rounded-lg text-xs font-mono uppercase focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
                      />
                      <button
                        type="submit"
                        disabled={patientLookupLoading}
                        className="h-10 px-4 bg-secondary text-white rounded-lg text-xs font-semibold hover:bg-on-secondary-container transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1 shadow-xs"
                      >
                        <span className="material-symbols-outlined text-sm">search</span>
                        <span>{patientLookupLoading ? 'Finding...' : 'Track'}</span>
                      </button>
                    </div>
                  </form>

                  {/* Quick Select Patient Tokens (Dynamic from live database) */}
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-outline block font-semibold">
                      Select From Active OPD Patients:
                    </span>
                    <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-1">
                      {(publicQueueState?.patients && publicQueueState.patients.length > 0
                        ? publicQueueState.patients.slice(0, 8)
                        : [
                            { token: 'MED-042', department: 'General Medicine', status: 'WAITING' },
                            { token: 'MED-039', department: 'General Medicine', status: 'SERVING' },
                            { token: 'CARD-013', department: 'Cardiology', status: 'WAITING' },
                            { token: 'ORTH-025', department: 'Orthopaedics', status: 'WAITING' },
                          ]
                      ).map((item) => (
                        <button
                          key={item.token}
                          type="button"
                          onClick={() => handleDirectTokenLookup(item.token)}
                          className="p-2.5 rounded-xl bg-white hover:bg-surface-container border border-outline-variant/70 flex items-center justify-between text-left transition-all hover:border-secondary shadow-xs group"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-primary group-hover:text-secondary">{item.token}</span>
                              <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-surface-container font-semibold text-primary">
                                {item.status}
                              </span>
                            </div>
                            <div className="text-[10px] text-on-surface-variant font-mono mt-0.5">
                              {item.department}
                            </div>
                          </div>
                          <span className="material-symbols-outlined text-sm text-outline group-hover:text-secondary transition-colors">
                            arrow_forward
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Register New Patient CTA */}
                  <div className="pt-2 border-t border-outline-variant/50 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => navigateTo('register')}
                      className="w-full bg-primary text-white font-semibold py-2.5 px-4 rounded-lg shadow-xs flex items-center justify-center gap-2 active:scale-95 transition-all text-xs"
                    >
                      <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
                      <span>Register New Patient & Generate Token</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateTo('home')}
                      className="w-full bg-surface-container text-primary font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 hover:bg-surface-container-high active:scale-95 transition-all text-xs border border-outline-variant"
                    >
                      <span className="material-symbols-outlined text-[16px]">home</span>
                      <span>Return to Hospital Landing</span>
                    </button>
                  </div>
                </main>
              </div>
            )
          )}

          {currentView === 'staff' && (
            <StaffDashboardView
              queueState={clinicalQueueState || (publicQueueState as unknown as SmartQueueState)}
              staffRole={staffRole}
              onToggleStaffRole={(role) => setStaffRole(role)}
              onRefresh={() => syncQueue()}
              onNavigate={navigateTo}
              onOpenScanner={() => handleOpenGateScanner()}
              onViewPatientChart={(p) => setChartModalPatient(p)}
              onOpenPatientPass={(p) => {
                updateCurrentPatient(p as any);
                setPassModalOpen(true);
              }}
            />
          )}

          {currentView === 'analytics' && (
            activeQueueState ? (
              <AnalyticsView
                queueState={activeQueueState}
                onNavigate={navigateTo}
              />
            ) : (
              <div className="h-screen w-full flex flex-col items-center justify-center p-6 bg-background text-center">
                <div className="w-12 h-12 rounded-xl bg-primary-container flex items-center justify-center text-secondary-fixed mb-3 shadow-md animate-pulse">
                  <span className="material-symbols-outlined text-3xl">monitoring</span>
                </div>
                <h2 className="text-base font-bold text-primary font-mono">Loading OPD Analytics...</h2>
                <p className="text-xs text-on-surface-variant mt-1 max-w-sm">
                  Synchronizing clinic caseload telemetry and predictive queue models...
                </p>
                <button
                  onClick={() => syncQueue()}
                  className="mt-4 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary-container transition-all flex items-center gap-1.5 shadow-xs"
                >
                  <span className="material-symbols-outlined text-sm">sync</span>
                  <span>Retry Sync</span>
                </button>
              </div>
            )
          )}
        </ErrorBoundary>
      </div>

      {/* MODALS */}
      {/* 30-Day Hospital Access Pass Modal */}
      {passModalOpen && currentPatient && (
        <PatientPassModal
          patient={currentPatient}
          onClose={() => setPassModalOpen(false)}
          onOpenScanner={(testCode) => {
            setPassModalOpen(false);
            handleOpenGateScanner(testCode || currentPatient.passId);
          }}
        />
      )}

      {/* Gate Scanner Terminal Modal */}
      {scannerModalOpen && (
        <ErrorBoundary fallbackTitle="Gate Scanner Terminal Error">
          <GateScannerModal
            initialCode={scannerModalCode || currentPatient?.passId || ''}
            onClose={handleCloseGateScanner}
          />
        </ErrorBoundary>
      )}

      {/* Clinical Chart Modal */}
      {chartModalPatient && (
        <PatientChartModal
          patient={chartModalPatient}
          onClose={() => setChartModalPatient(null)}
          onCompleteConsultation={() => {
            syncQueue();
          }}
          onOpenPass={(p) => {
            updateCurrentPatient(p as any);
            setPassModalOpen(true);
          }}
        />
      )}

      {/* Token / Patient Lookup Modal */}
      {lookupModalOpen && (
        <TokenLookupModal
          onClose={() => setLookupModalOpen(false)}
          onPatientFound={handlePatientFound}
          recentTokens={publicQueueState?.patients?.map((p) => ({
            token: p.token,
            label: `${p.token} • ${p.department} (${p.status})`,
          }))}
        />
      )}
    </div>
  );
}
