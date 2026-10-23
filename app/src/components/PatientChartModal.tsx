import React, { useState } from 'react';
import { PatientRecord } from '../types/queue';
import { updatePatientNotes, staffCompleteConsultation } from '../services/api';

interface PatientChartModalProps {
  patient: PatientRecord;
  onClose: () => void;
  onCompleteConsultation?: () => void;
  onOpenPass?: (patient: PatientRecord) => void;
}

export const PatientChartModal: React.FC<PatientChartModalProps> = ({
  patient,
  onClose,
  onCompleteConsultation,
  onOpenPass,
}) => {
  const [notes, setNotes] = useState(
    patient.notes ||
      'Patient presents alert, oriented x 3. Vital signs stable. Neurological exam grossly intact. Recommending dark room rest, IV fluids, and Sumatriptan response monitoring.'
  );
  const [notesRecorded, setNotesRecorded] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [completingVisit, setCompletingVisit] = useState(false);
  const [prescriptionAdded, setPrescriptionAdded] = useState(false);
  const [labOrdered, setLabOrdered] = useState(false);

  const handleSaveNotes = async () => {
    setNotesSaving(true);
    setNotesError(null);
    try {
      await updatePatientNotes(patient.token, notes);
      setNotesRecorded(true);
      setTimeout(() => setNotesRecorded(false), 3000);
    } catch (err: any) {
      setNotesError(err.message || 'Failed to save notes to database');
    } finally {
      setNotesSaving(false);
    }
  };

  const handleCompleteVisit = async () => {
    setCompletingVisit(true);
    try {
      await staffCompleteConsultation(patient.department);
      if (onCompleteConsultation) {
        onCompleteConsultation();
      }
      onClose();
    } catch (err: any) {
      console.error('Failed to complete consultation:', err);
      if (onCompleteConsultation) {
        onCompleteConsultation();
      }
      onClose();
    } finally {
      setCompletingVisit(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 lg:p-6 bg-primary/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-background rounded-2xl shadow-2xl border border-outline-variant overflow-hidden my-auto max-h-[95vh] flex flex-col">
        {/* Top Header */}
        <header className="bg-surface-container-lowest border-b border-outline-variant px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[20px]">local_hospital</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-primary tracking-tight">Authorized Clinical Chart</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-primary text-white font-semibold">
                  Badge #8841 Authenticated
                </span>
              </div>
              <p className="text-xs text-on-surface-variant">St. Jude Memorial Hospital • Protected EHR Record</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </header>

        {/* Scrollable Patient Canvas */}
        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          {/* Patient Overview Header Card */}
          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-xs relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-secondary"></div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-14 h-14 rounded-lg bg-surface-container-high border border-outline-variant flex flex-col items-center justify-center shrink-0 text-primary">
                  <span className="font-mono text-lg font-bold">
                    {(patient.fullName || 'Patient')
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2) || 'PT'}
                  </span>
                  <span className="text-[9px] font-mono text-on-surface-variant">PT-{patient.token.slice(-3)}</span>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="text-xl font-bold text-primary tracking-tight">{patient.fullName}</h3>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      {patient.status === 'SERVING'
                        ? 'Consultation in Progress'
                        : patient.status === 'WAITING'
                        ? 'In Waiting Queue'
                        : 'Discharged / Completed'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 text-xs text-on-surface-variant">
                    <span><strong>Age:</strong> {patient.age}</span>
                    <span>•</span>
                    <span><strong>Gender:</strong> {patient.gender}</span>
                    <span>•</span>
                    <span><strong>Department:</strong> <strong className="text-secondary">{patient.department}</strong></span>
                    <span>•</span>
                    <span><strong>Attending:</strong> {patient.doctor}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 bg-surface-container-low rounded border border-outline-variant text-[11px] text-primary">
                      Pass Status: <strong className="text-secondary font-mono">{patient.passStatus || 'Active'} ({patient.passId})</strong>
                    </span>
                    {onOpenPass && (
                      <button
                        type="button"
                        onClick={() => onOpenPass(patient)}
                        className="px-2 py-0.5 bg-secondary text-white rounded text-[11px] font-semibold hover:bg-on-secondary-container transition-all flex items-center gap-1 shadow-xs"
                      >
                        <span className="material-symbols-outlined text-[13px]">qr_code_2</span>
                        <span>Open QR Pass</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Token badge */}
              <div className="flex md:flex-col items-center md:items-end justify-between border-t md:border-t-0 md:border-l border-outline-variant/70 pt-2 md:pt-0 md:pl-5">
                <div className="text-left md:text-right">
                  <span className="text-[10px] text-on-surface-variant uppercase font-mono block">OPD Token</span>
                  <span className="font-mono text-3xl font-bold text-primary tracking-widest">{patient.token}</span>
                  <span className="text-xs font-semibold text-secondary block">{patient.room}</span>
                </div>
              </div>
            </div>
          </section>

          {/* 2-Column Split: Demographics & Clinical Records */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Left Column: Administrative Demographics */}
            <div className="md:col-span-5 space-y-3">
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-outline-variant">
                  <h4 className="font-bold text-xs uppercase tracking-wide text-primary flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">badge</span>
                    Registration & Demographics
                  </h4>
                  <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-surface-container text-on-surface-variant font-mono">
                    Public/Admin
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-2.5 bg-surface-container-low rounded border border-outline-variant/60">
                    <span className="text-[10px] text-on-surface-variant uppercase block">Legal Name</span>
                    <p className="font-semibold text-primary">{patient.fullName}</p>
                    <span className="text-[10px] text-on-surface-variant uppercase block mt-2">Contact Phone</span>
                    <p className="font-mono text-secondary font-semibold">{patient.contactNumber}</p>
                  </div>

                  <div className="p-2.5 bg-surface-container-low rounded border border-outline-variant/60">
                    <span className="text-[10px] text-on-surface-variant uppercase block">Patient ID / MRN</span>
                    <p className="font-mono text-primary font-bold">{patient.id} {patient.mrn ? `(${patient.mrn})` : ''}</p>
                    <span className="text-[10px] text-on-surface-variant uppercase block mt-2">Registered Address</span>
                    <p className="text-on-surface">Westwood District, Ward 4, St. Jude Metropolitan Area</p>
                  </div>

                  <div className="p-2.5 bg-surface-container rounded border border-outline-variant flex items-start gap-2">
                    <span className="material-symbols-outlined text-secondary text-[16px] shrink-0 mt-0.5">check_circle</span>
                    <div>
                      <span className="text-[10px] font-bold text-on-secondary-container uppercase block">Consent Verified</span>
                      <p className="text-[11px] text-on-surface-variant leading-snug">
                        Signed digital consent for OPD triage queue data storage and clinical coordination.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Protected Clinical Layer */}
            <div className="md:col-span-7 space-y-3">
              <div className="bg-surface-container-lowest border-2 border-primary/20 rounded-xl p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-outline-variant">
                  <h4 className="font-bold text-xs uppercase tracking-wide text-primary flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px] text-secondary">lock</span>
                    Protected Clinical Layer
                  </h4>
                  <span className="text-[10px] font-mono text-on-surface-variant">Confidential (HIPAA Triage)</span>
                </div>

                {/* Chief Complaint */}
                <div className="p-3 bg-surface-container-low rounded border-l-4 border-primary border border-outline-variant/80">
                  <span className="text-[10px] text-on-surface-variant uppercase font-semibold block mb-0.5">
                    Chief Medical Complaint & Triage
                  </span>
                  <p className="text-sm font-bold text-primary">"{patient.chiefComplaint}"</p>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Priority status: <strong className="text-primary">{patient.triageSeverity}</strong>. Attending: {patient.doctor}.
                  </p>
                </div>

                {/* Critical Allergies */}
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-1.5 mb-1.5 text-xs font-bold text-red-900">
                    <span className="material-symbols-outlined text-[16px] text-red-700">warning</span>
                    <span>Known Critical Allergies</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {patient.allergies && patient.allergies.length > 0 ? (
                      patient.allergies.map((all, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded bg-white text-red-900 border border-red-200 text-xs font-semibold"
                        >
                          {all}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-on-surface-variant">No known drug allergies reported</span>
                    )}
                  </div>
                </div>

                {/* Notes editing */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-primary flex items-center justify-between">
                    <span>Attending Consultation Notes</span>
                    {notesRecorded && <span className="text-emerald-700 text-[11px] font-normal">Saved to Database ✓</span>}
                  </label>
                  {notesError && (
                    <div className="text-[11px] text-red-600 bg-red-50 p-1.5 rounded border border-red-200">
                      {notesError}
                    </div>
                  )}
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full text-xs p-2 rounded border border-outline-variant bg-white focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary font-sans"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={notesSaving}
                      onClick={handleSaveNotes}
                      className="px-2.5 py-1 text-xs bg-surface-container hover:bg-surface-container-high rounded text-primary font-semibold transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[13px]">save</span>
                      <span>{notesSaving ? 'Saving to DB...' : 'Save Notes'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Action Strip */}
        <footer className="bg-surface-container-lowest border-t border-outline-variant px-5 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-on-surface-variant">
            <span className="material-symbols-outlined text-secondary text-[18px]">verified_user</span>
            <span>Room: <strong>{patient.room}</strong> • Current Token: <strong className="font-mono text-primary">{patient.token}</strong></span>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={() => {
                setPrescriptionAdded(true);
              }}
              className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all ${
                prescriptionAdded ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-white border-outline text-primary hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-[14px] align-middle mr-1 text-secondary">pill</span>
              {prescriptionAdded ? 'Prescription Ordered ✓' : 'Prescribe Medication'}
            </button>
            <button
              onClick={() => {
                setLabOrdered(true);
              }}
              className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all ${
                labOrdered ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-white border-outline text-primary hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-[14px] align-middle mr-1 text-secondary">biotechnology</span>
              {labOrdered ? 'Lab Order Sent ✓' : 'Order Lab Test'}
            </button>
            {onCompleteConsultation && (
              <button
                type="button"
                disabled={completingVisit}
                onClick={handleCompleteVisit}
                className="px-4 py-1.5 bg-secondary hover:bg-on-secondary-container text-white rounded text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                <span>{completingVisit ? 'Completing...' : 'Complete Visit & Discharge'}</span>
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
};
