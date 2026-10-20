import { useState, useEffect, useCallback } from 'react';
import { fetchQueueState, lookupTokenOrPatient } from './services/api';
import { PatientQueueView, PatientRecord, SmartQueueState } from './types/queue';
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
  const [queueState, setQueueState] = useState<SmartQueueState | null>(null);
  const [currentPatient, setCurrentPatient] = useState<PatientQueueView | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Modals
  const [passModalOpen, setPassModalOpen] = useState(false);
  const [scannerModalOpen, setScannerModalOpen] = useState(false);
  const [lookupModalOpen, setLookupModalOpen] = useState(false);
  const [chartModalPatient, setChartModalPatient] = useState<PatientRecord | null>(null);

  // Sync Queue State from backend
  const syncQueue = useCallback(async (patientToken?: string) => {
    setIsSyncing(true);
    try {
      const state = await fetchQueueState();
      setQueueState(state);

      // If we have an active patient, refresh their telemetry too
      const targetToken = patientToken || currentPatient?.token || 'MED-042';
      try {
        const pView = await lookupTokenOrPatient(targetToken);
        setCurrentPatient(pView);
      } catch (err) {
        // If target token not found, default to first waiting or serving in General Medicine
        if (state.patients.length > 0) {
          const fallback = state.patients[0];
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
  }, [currentPatient?.token]);

  // Initial fetch and auto-polling every 4 seconds to maintain synchronized real-time state across clients
  useEffect(() => {
    syncQueue('MED-042');
    const interval = setInterval(() => {
      syncQueue();
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleRegistered = (newPatient: PatientQueueView) => {
    setCurrentPatient(newPatient);
    setCurrentView('patient');
    syncQueue(newPatient.token);
  };

  const handlePatientFound = (found: PatientQueueView) => {
    setCurrentPatient(found);
    setCurrentView('patient');
  };

  if (initialLoading && !queueState) {
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
        onOpenScanner={() => setScannerModalOpen(true)}
        patientToken={currentPatient?.token}
        isSyncing={isSyncing}
      />

      {/* Main View Router */}
      <div className="flex-1 flex flex-col">
        {currentView === 'home' && (
          <HomeView
            queueState={queueState}
            onNavigate={setCurrentView}
            onLookupToken={() => setLookupModalOpen(true)}
          />
        )}

        {currentView === 'register' && (
          <RegisterView
            queueState={queueState}
            onRegistered={handleRegistered}
            onNavigate={setCurrentView}
            onLookupToken={() => setLookupModalOpen(true)}
          />
        )}

        {currentView === 'patient' && currentPatient && (
          <PatientLiveView
            patientView={currentPatient}
            queueState={queueState}
            onRefresh={() => syncQueue(currentPatient.token)}
            onNavigate={setCurrentView}
            onOpenPass={() => setPassModalOpen(true)}
            onLookupToken={() => setLookupModalOpen(true)}
          />
        )}

        {currentView === 'staff' && queueState && (
          <StaffDashboardView
            queueState={queueState}
            onRefresh={() => syncQueue()}
            onNavigate={setCurrentView}
            onOpenScanner={() => setScannerModalOpen(true)}
            onViewPatientChart={(p) => setChartModalPatient(p)}
          />
        )}

        {currentView === 'analytics' && queueState && (
          <AnalyticsView
            queueState={queueState}
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
          onOpenScanner={() => {
            setPassModalOpen(false);
            setScannerModalOpen(true);
          }}
        />
      )}

      {/* Gate Scanner Terminal Modal */}
      {scannerModalOpen && (
        <GateScannerModal
          initialCode={currentPatient?.passId || 'SQ-PASS-90412-B'}
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
