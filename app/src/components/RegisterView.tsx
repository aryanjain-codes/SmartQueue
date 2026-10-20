import React, { useState } from 'react';
import { registerPatient } from '../services/api';
import { OPDDepartment, PatientQueueView, SmartQueueState } from '../types/queue';

interface RegisterViewProps {
  queueState: SmartQueueState | null;
  onRegistered: (patientView: PatientQueueView) => void;
  onNavigate: (view: 'home' | 'register' | 'patient' | 'staff' | 'analytics') => void;
  onLookupToken: () => void;
}

export const RegisterView: React.FC<RegisterViewProps> = ({
  queueState,
  onRegistered,
  onNavigate,
  onLookupToken,
}) => {
  const [fullName, setFullName] = useState('Eleanor Vance');
  const [age, setAge] = useState('34');
  const [gender, setGender] = useState('Female');
  const [contactNumber, setContactNumber] = useState('(555) 234-8910');
  const [mrn, setMrn] = useState('SJ-98214-X');
  const [department, setDepartment] = useState<OPDDepartment>('General Medicine');
  const [chiefComplaint, setChiefComplaint] = useState(
    'Mild recurrent migraine and photophobia for 3 days'
  );
  const [allergies, setAllergies] = useState<string[]>(['Penicillin']);
  const [consent, setConsent] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleAllergy = (name: string) => {
    if (name === 'None reported') {
      setAllergies(['None reported']);
      return;
    }
    const withoutNone = allergies.filter((a) => a !== 'None reported');
    if (withoutNone.includes(name)) {
      setAllergies(withoutNone.filter((a) => a !== name));
    } else {
      setAllergies([...withoutNone, name]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || fullName.trim().length < 2) {
      setError('Please provide a valid full legal name.');
      return;
    }
    const ageNum = parseInt(age, 10);
    if (isNaN(ageNum) || ageNum < 0 || ageNum > 125) {
      setError('Please provide a valid age between 0 and 125.');
      return;
    }
    if (!contactNumber.trim() || contactNumber.trim().length < 7) {
      setError('Please provide a valid contact phone number.');
      return;
    }
    if (!chiefComplaint.trim()) {
      setError('Please describe your primary reason or chief complaint.');
      return;
    }
    if (!consent) {
      setError('Patient triage consent is required to issue an OPD token.');
      return;
    }

    setLoading(true);
    try {
      const newPatient = await registerPatient({
        fullName: fullName.trim(),
        age: ageNum,
        gender,
        contactNumber: contactNumber.trim(),
        mrn: mrn.trim() || undefined,
        department,
        chiefComplaint: chiefComplaint.trim(),
        allergies: allergies.length > 0 ? allergies : ['None reported'],
      });
      onRegistered(newPatient);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to complete OPD registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Compute live waiting counts per department
  const genWait = queueState?.departments?.['General Medicine']?.waitingCount ?? 4;
  const cardWait = queueState?.departments?.['Cardiology']?.waitingCount ?? 2;
  const orthWait = queueState?.departments?.['Orthopaedics']?.waitingCount ?? 2;

  const currentDeptWaitMins =
    queueState?.departments?.[department]?.averageWaitMinutes ?? 18;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-surface-container-lowest flex flex-col relative pb-20 shadow-sm">
      {/* Top Bar Header */}
      <header className="bg-surface-container-lowest sticky top-0 z-40 w-full shadow-xs border-b border-outline-variant/30">
        <div className="flex justify-between items-center w-full px-4 h-14">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('home')}
              className="p-1.5 text-on-surface hover:bg-surface-container rounded-lg active:scale-95 transition-all"
              type="button"
              aria-label="Go back"
            >
              <span className="material-symbols-outlined text-primary text-xl">arrow_back</span>
            </button>
            <div className="flex flex-col">
              <span className="font-bold text-base text-primary tracking-tight leading-tight">SmartQueue OPD</span>
              <span className="text-[10px] text-secondary uppercase tracking-wider font-semibold">
                St. Jude Memorial Hospital
              </span>
            </div>
          </div>
          <button
            onClick={() => onNavigate('staff')}
            className="text-on-surface-variant hover:text-primary p-1.5 rounded-full hover:bg-surface-container transition-colors"
            title="Staff Portal"
          >
            <span className="material-symbols-outlined text-xl">badge</span>
          </button>
        </div>
      </header>

      {/* Step Indicator Banner */}
      <section className="bg-surface-container-lowest border-b border-outline-variant/30 px-4 pt-3 pb-3 w-full">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-secondary animate-pulse"></span>
            <span className="text-[11px] text-secondary uppercase font-bold tracking-wider">New OPD Registration</span>
          </div>
          <span className="font-mono text-xs text-on-surface-variant font-medium">Step 1 of 2</span>
        </div>
        <h1 className="text-xl font-bold text-primary tracking-tight mb-0.5">Patient & Clinic Details</h1>
        <p className="text-xs text-on-surface-variant">Complete clinical triage check-in to secure your digital appointment token.</p>
        <div className="w-full bg-surface-container rounded-full h-1.5 mt-2.5 overflow-hidden flex">
          <div className="bg-secondary h-full rounded-full w-1/2 transition-all duration-300"></div>
          <div className="bg-surface-container-high h-full w-1/2"></div>
        </div>
      </section>

      {/* Main Form */}
      <main className="flex-1 w-full px-4 py-4 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-900 rounded-lg text-xs flex items-start gap-2">
            <span className="material-symbols-outlined text-red-600 text-sm mt-0.5">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Required Notice */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container-low rounded-lg border border-outline-variant/40 text-xs text-on-surface-variant">
          <span className="material-symbols-outlined text-secondary text-base">info</span>
          <span>
            Fields marked with <span className="text-error font-semibold">*</span> are required for triage prioritization.
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. Full Legal Name */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-primary" htmlFor="fullName">
              Full Legal Name <span className="text-error">*</span>
            </label>
            <div className="relative">
              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Eleanor Vance"
                className="w-full h-10 px-3 pr-9 rounded-lg border border-outline-variant bg-white text-on-surface text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
              />
              {fullName.trim().length >= 2 && (
                <div className="absolute right-3 top-2.5 text-secondary">
                  <span className="material-symbols-outlined text-base">check_circle</span>
                </div>
              )}
            </div>
            <p className="text-[11px] text-on-surface-variant">As printed on government health identity or insurance card.</p>
          </div>

          {/* 2. Age & Gender Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-primary" htmlFor="patientAge">
                Age (Yrs) <span className="text-error">*</span>
              </label>
              <input
                id="patientAge"
                type="number"
                min={0}
                max={125}
                required
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="e.g. 34"
                className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-white text-on-surface font-mono text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-primary" htmlFor="patientGender">
                Gender <span className="text-error">*</span>
              </label>
              <div className="relative">
                <select
                  id="patientGender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full h-10 pl-3 pr-8 rounded-lg border border-outline-variant bg-white text-on-surface text-sm appearance-none focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
                >
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Non-Binary">Non-Binary</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-on-surface-variant">
                  <span className="material-symbols-outlined text-base">expand_more</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Contact Phone */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-primary" htmlFor="contactNumber">
              Contact Mobile Number <span className="text-error">*</span>
            </label>
            <div className="flex rounded-lg">
              <span className="inline-flex items-center px-2.5 rounded-l-lg border border-r-0 border-outline-variant bg-surface-container-low text-primary font-mono text-xs font-semibold">
                +1 (US)
              </span>
              <input
                id="contactNumber"
                type="tel"
                required
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="(555) 234-8910"
                className="flex-1 min-w-0 block w-full h-10 px-3 rounded-none rounded-r-lg border border-outline-variant bg-white text-on-surface font-mono text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
              />
            </div>
            <p className="text-[11px] text-on-surface-variant">Live token summons and SMS alert pings will be dispatched here.</p>
          </div>

          {/* 4. Health ID / MRN (Optional) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-primary" htmlFor="healthId">
                Health ID / MRN <span className="text-on-surface-variant font-normal text-[11px]">(Optional)</span>
              </label>
              <span className="text-[10px] text-secondary font-mono uppercase font-semibold">St. Jude MRN</span>
            </div>
            <input
              id="healthId"
              type="text"
              value={mrn}
              onChange={(e) => setMrn(e.target.value)}
              placeholder="e.g. SJ-98214-X"
              className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-white text-on-surface font-mono text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
            />
          </div>

          {/* 5. Select OPD Department */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-primary" htmlFor="opdDepartment">
                Select OPD Department <span className="text-error">*</span>
              </label>
              <span className="inline-flex items-center gap-1 text-[11px] text-secondary font-semibold bg-secondary-container/30 px-2 py-0.5 rounded">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                Active Desks
              </span>
            </div>
            <div className="relative">
              <select
                id="opdDepartment"
                value={department}
                onChange={(e) => setDepartment(e.target.value as OPDDepartment)}
                className="w-full h-10.5 pl-3 pr-10 rounded-lg border border-outline-variant bg-white text-on-surface text-sm appearance-none focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
              >
                <option value="General Medicine">General Medicine (Room 104 - {genWait} waiting)</option>
                <option value="Cardiology">Cardiology (Room 102 - {cardWait} waiting)</option>
                <option value="Orthopaedics">Orthopaedics (Room 105 - {orthWait} waiting)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-on-surface-variant">
                <span className="material-symbols-outlined text-base">unfold_more</span>
              </div>
            </div>
            {/* Real-time Department wait indicator */}
            <div className="flex items-center gap-2 p-2 bg-surface-container-low rounded border border-outline-variant/30 text-xs">
              <span className="material-symbols-outlined text-secondary text-sm">schedule</span>
              <span className="text-on-surface-variant">
                Est. Triage Queue Time:{' '}
                <strong className="text-primary font-semibold">{currentDeptWaitMins}–{currentDeptWaitMins + 7} mins</strong>{' '}
                at Room {department === 'Cardiology' ? '102' : department === 'Orthopaedics' ? '105' : '104'}
              </span>
            </div>
          </div>

          {/* 6. Chief Complaint */}
          <div className="space-y-1">
            <div className="flex justify-between items-baseline">
              <label className="block text-xs font-semibold text-primary" htmlFor="medicalComplaint">
                Primary Reason / Chief Complaint <span className="text-error">*</span>
              </label>
              <span className="text-[11px] text-on-surface-variant">Brief clinical note</span>
            </div>
            <textarea
              id="medicalComplaint"
              rows={3}
              required
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              placeholder="Describe main symptoms, onset duration, and severity..."
              className="w-full p-2.5 rounded-lg border border-outline-variant bg-white text-on-surface text-xs focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all resize-none"
            />
            <p className="text-[11px] text-on-surface-variant">Provides attending triage nurses initial context for priority routing.</p>
          </div>

          {/* 7. Critical Allergies Toggle */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-primary">
              Known Critical Allergies <span className="text-error">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { name: 'Penicillin', icon: 'medication' },
                { name: 'Sulfa Drugs', icon: 'vaccines' },
                { name: 'None reported', icon: 'do_not_disturb_on' },
              ].map((item) => {
                const isSelected = allergies.includes(item.name);
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => toggleAllergy(item.name)}
                    className={`relative flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all active:scale-95 ${
                      isSelected
                        ? 'border-2 border-secondary bg-secondary-container/20 text-secondary'
                        : 'border-outline-variant bg-white text-on-surface hover:bg-surface-container-low'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base mb-1">{item.icon}</span>
                    <span className="text-xs font-medium">{item.name}</span>
                    {isSelected && (
                      <span className="absolute top-1 right-1 text-secondary">
                        <span className="material-symbols-outlined text-xs">check_circle</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mandatory Consent Box */}
          <section className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/60 space-y-2">
            <div className="flex items-start gap-2.5">
              <input
                id="consent"
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded text-secondary border-outline focus:ring-secondary cursor-pointer"
              />
              <label htmlFor="consent" className="text-xs text-on-surface leading-tight cursor-pointer">
                I consent to St. Jude Hospital storing and sharing my queue and triage info with attending clinical staff for this OPD visit. <span className="text-error font-bold">*</span>
              </label>
            </div>
            <div className="flex items-start gap-1.5 pt-2 border-t border-outline-variant/30 text-[10px] text-on-surface-variant">
              <span className="material-symbols-outlined text-secondary text-sm shrink-0">lock</span>
              <span>Your medical history is never shared publicly or stored in unencrypted QR codes.</span>
            </div>
          </section>

          {/* Buttons */}
          <div className="pt-2 space-y-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-primary text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 shadow-sm hover:bg-primary-container active:scale-98 transition-all disabled:opacity-70"
            >
              <span>{loading ? 'Processing Triage...' : 'Generate My Digital Token'}</span>
              <span className="material-symbols-outlined text-secondary-fixed text-lg">arrow_forward</span>
            </button>
            <button
              type="button"
              onClick={onLookupToken}
              className="w-full h-9 bg-transparent hover:bg-surface-container text-secondary text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
            >
              <span className="material-symbols-outlined text-base">manage_search</span>
              <span>Already registered? Look up Token</span>
            </button>
          </div>
        </form>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 w-full z-40 flex justify-around items-center px-2 py-1.5 pb-safe bg-surface-container-lowest shadow-sm max-w-md left-1/2 -translate-x-1/2 border-t border-outline-variant/40">
        <button
          onClick={() => onNavigate('home')}
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary px-3 py-1 transition-colors"
        >
          <span className="material-symbols-outlined text-xl">home</span>
          <span className="text-[10px] mt-0.5">Home</span>
        </button>
        <button
          onClick={() => onNavigate('patient')}
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary px-3 py-1 transition-colors"
        >
          <span className="material-symbols-outlined text-xl">queue</span>
          <span className="text-[10px] mt-0.5">Live Queue</span>
        </button>
        <button
          onClick={() => onNavigate('register')}
          className="flex flex-col items-center justify-center text-secondary bg-secondary-container/20 rounded-lg px-3 py-1 font-semibold"
        >
          <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            assignment
          </span>
          <span className="text-[10px] mt-0.5">Check-In</span>
        </button>
        <button
          onClick={() => onNavigate('staff')}
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary px-3 py-1 transition-colors"
        >
          <span className="material-symbols-outlined text-xl">badge</span>
          <span className="text-[10px] mt-0.5">Staff</span>
        </button>
      </nav>
    </div>
  );
};
