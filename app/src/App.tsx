import { useState, useEffect, useCallback } from 'react';
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

export default function App() {
  const [currentView, setCurrentView] = useState<'home' | 'register' | 'patient' | 'staff' | 'analytics'>('home');
  const [publicQueueState, setPublicQueueState] = useState<PublicQueueStateDTO | null>(null);
  const [clinicalQueueState, setClinicalQueueState] = useState<SmartQueueState | null>(null);
  const [currentPatient, setCurrentPatient] = useState<PatientQueueView | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Modals
  const [passModalOpen, setPassModalOpen] = useState(false);
  const [scannerModalOpen, setScannerModalOpen] = useState(false);
  const [scannerModalCode, setScannerModalCode] = useState<string>('');
  const [lookupModalOpen, setLookupModalOpen] = useState(false);
  const [chartModalPatient, setChartModalPatient] = useState<PatientRecord | null>(null);

  // Synchronize queue state from backend (public or clinical based on view)
  const syncQueue = useCallback(async (patientToken?: string) => {
    setIsSyncing(true);
    try {
      // 1. Always fetch public queue state
      const pubState = await fetchQueueState();
      setPublicQueueState(pubState);

      // 2. If in staff view, fetch protected clinical queue state using clinical staff credentials
      if (currentView === 'staff') {
        try {
          const clinState = await fetchClinicalQueueState();
          setClinicalQueueState(clinState);
        } catch (cErr) {
          console.warn('Clinical sync error:', cErr);
        }
      }

      // 3. If we have an active patient, refresh their telemetry too
      const targetToken = patientToken || currentPatient?.token || 'MED-042';
      try {
        const pView = await lookupTokenOrPatient(targetToken);
        setCurrentPatient(pView);
      } catch (err) {
        if (pubState.patients.length > 0) {
          const fallback = pubState.patients[0];
          const fView = await lookupTokenOrPatient(fallback.token);
          setCurrentPatient(fView);
        }
      }
    } catch (err) {
      console.error('Failed to sync queue state:', err);
    } finally {
      setIsSyncing(false);
      setInitialLoading(false);
    }
  }, [currentPatient?.token, currentView]);

  // Initial fetch and auto-polling every 4 seconds to maintain synchronized real-time state across clients
  useEffect(() => {
    syncQueue('MED-042');
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
    setCurrentPatient(newPatient);
    setCurrentView('patient');
    syncQueue(newPatient.token);
  };

  const handlePatientFound = (found: PatientQueueView) => {
    setCurrentPatient(found);
    setCurrentView('patient');
  };

  const activeQueueState = clinicalQueueState || publicQueueState;

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

  return (
    <div className="min-h-screen bg-background flex flex-col antialiased selection:bg-secondary-container selection:text-on-secondary-container">
      {/* Top Universal View Switcher */}
      <GlobalViewSwitcher
        currentView={currentView}
        onNavigate={setCurrentView}
        onOpenScanner={() => {
          setScannerModalCode(currentPatient?.passId || 'SQ-PASS-90412E5F6A7B8C9D0E1F-B');
          setScannerModalOpen(true);
        }}
        patientToken={currentPatient?.token}
        isSyncing={isSyncing}
      />

      {/* Main View Router */}
      <div className="flex-1 flex flex-col">
        {currentView === 'home' && (
          <HomeView
            queueState={publicQueueState}
            onNavigate={setCurrentView}
            onLookupToken={() => setLookupModalOpen(true)}
          />
        )}

        {currentView === 'register' && (
          <RegisterView
            queueState={publicQueueState}
            onRegistered={handleRegistered}
            onNavigate={setCurrentView}
            onLookupToken={() => setLookupModalOpen(true)}
          />
        )}

        {currentView === 'patient' && currentPatient && (
          <PatientLiveView
            patientView={currentPatient}
            queueState={publicQueueState}
            onRefresh={() => syncQueue(currentPatient.token)}
            onNavigate={setCurrentView}
            onOpenPass={() => setPassModalOpen(true)}
            onLookupToken={() => setLookupModalOpen(true)}
          />
        )}

        {currentView === 'staff' && (
          <StaffDashboardView
            queueState={clinicalQueueState || (publicQueueState as unknown as SmartQueueState)}
            onRefresh={() => syncQueue()}
            onNavigate={setCurrentView}
            onOpenScanner={() => {
              setScannerModalCode(currentPatient?.passId || 'SQ-PASS-90412E5F6A7B8C9D0E1F-B');
              setScannerModalOpen(true);
            }}
            onViewPatientChart={(p) => setChartModalPatient(p)}
          />
        )}

        {currentView === 'analytics' && activeQueueState && (
          <AnalyticsView
            queueState={activeQueueState}
            onNavigate={setCurrentView}
          />
        )}
      </div>

      {/* MODALS */}
      {/* 30-Day Hospital Access Pass Modal */}
      {passModalOpen && currentPatient && (
        <PatientPassModal
          patient={currentPatient}
          onClose={() => setPassModalOpen(false)}
          onOpenScanner={(testCode) => {
            setPassModalOpen(false);
            setScannerModalCode(testCode || currentPatient.passId);
            setScannerModalOpen(true);
          }}
        />
      )}

      {/* Gate Scanner Terminal Modal */}
      {scannerModalOpen && (
        <GateScannerModal
          initialCode={scannerModalCode || currentPatient?.passId || 'SQ-PASS-90412E5F6A7B8C9D0E1F-B'}
          onClose={() => setScannerModalOpen(false)}
        />
      )}

      {/* Clinical Chart Modal */}
      {chartModalPatient && (
        <PatientChartModal
          patient={chartModalPatient}
          onClose={() => setChartModalPatient(null)}
          onCompleteConsultation={() => {
            syncQueue();
          }}
        />
      )}

      {/* Token / Patient Lookup Modal */}
      {lookupModalOpen && (
        <TokenLookupModal
          onClose={() => setLookupModalOpen(false)}
          onPatientFound={handlePatientFound}
        />
      )}
    </div>
  );
}
