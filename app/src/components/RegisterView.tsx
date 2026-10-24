import React, { useState } from 'react';
import { registerPatient } from '../services/api';
import { OPDDepartment, PatientQueueView, AnyQueueState } from '../types/queue';

interface RegisterViewProps {
  queueState: AnyQueueState | null;
  onRegistered: (patientView: PatientQueueView) => void;
  onNavigate: (view: 'home' | 'register' | 'patient' | 'staff' | 'analytics') => void;
  onLookupToken: () => void;
}

/**
 * Strips formatting, removes accidental duplicate country code (+91/91/0),
 * and formats the 10-digit Indian mobile number as "XXXXX XXXXX".
 */
export function cleanAndFormatIndianPhone(input: string): string {
  let val = input.trim();

  // Strip duplicate country codes if pasted or typed
  if (val.startsWith('+91')) {
    val = val.slice(3);
  } else if (val.startsWith('91') && val.replace(/\D/g, '').length > 10) {
    val = val.slice(2);
  } else if (val.startsWith('0') && val.replace(/\D/g, '').length === 11) {
    val = val.slice(1);
  }

  // Extract digits only up to 10 max
  const digits = val.replace(/\D/g, '').slice(0, 10);

  if (digits.length <= 5) {
    return digits;
  }
  return `${digits.slice(0, 5)} ${digits.slice(5)}`;
}

export const RegisterView: React.FC<RegisterViewProps> = ({
  queueState,
  onRegistered,
  onNavigate,
  onLookupToken,
}) => {
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');
  const [countryCode, setCountryCode] = useState('+91');
  const [contactNumber, setContactNumber] = useState('');
  const [mrn, setMrn] = useState('');
  const [department, setDepartment] = useState<OPDDepartment>('General Medicine');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);

  const fillSampleDemoData = () => {
    setFullName('Aryan Verma');
    setAge('28');
    setGender('Male');
    setCountryCode('+91');
    setContactNumber('98765 43210');
    setMrn('SJH-IND-44102');
    setDepartment('General Medicine');
    setChiefComplaint('Mild recurrent migraine and photophobia for 2 days');
    setAllergies(['None reported']);
    setConsent(true);
  };

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

    let formattedPhone = contactNumber.trim();
    if (countryCode === '+91') {
      const digits = contactNumber.replace(/\D/g, '');
      if (digits.length !== 10) {
        setError('Please provide a valid 10-digit Indian mobile number (+91 XXXXX XXXXX).');
        return;
      }
      if (!/^[6-9]\d{9}$/.test(digits)) {
        setError('Indian mobile numbers must start with 6, 7, 8, or 9 (e.g. +91 98765 43210).');
        return;
      }
      formattedPhone = `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
    } else {
      if (!formattedPhone || formattedPhone.replace(/\D/g, '').length < 7) {
        setError('Please provide a valid contact mobile number.');
        return;
      }
      formattedPhone = `${countryCode} ${formattedPhone}`;
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
        contactNumber: formattedPhone,
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
  const genWait = queueState?.departments?.['General Medicine']?.waitingCount ?? 9;
  const cardWait = queueState?.departments?.['Cardiology']?.waitingCount ?? 4;
  const orthWait = queueState?.departments?.['Orthopaedics']?.waitingCount ?? 4;

  const currentDeptWaitMins =
    queueState?.departments?.[department]?.averageWaitMinutes ?? 14;

  return (
    <div className="w-full max-w-md md:max-w-4xl lg:max-w-5xl mx-auto min-h-screen bg-surface-container-lowest flex flex-col relative pb-20 md:pb-8 shadow-sm">
      {/* Top Bar Header */}
      <header className="bg-surface-container-lowest sticky top-0 z-40 w-full shadow-xs border-b border-outline-variant/30">
        <div className="flex justify-between items-center w-full px-4 md:px-6 h-14">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onNavigate('home')}
              className="p-1.5 text-on-surface hover:bg-surface-container rounded-lg active:scale-95 transition-all cursor-pointer"
              type="button"
              aria-label="Go back to Home"
            >
              <span className="material-symbols-outlined text-primary text-xl">arrow_back</span>
            </button>
            <div className="flex flex-col">
              <span className="font-bold text-base text-primary tracking-tight leading-tight">SmartQueue OPD</span>
              <span className="text-[10px] text-secondary uppercase tracking-wider font-semibold font-mono">
                St. Jude Memorial Hospital
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fillSampleDemoData}
              className="px-2.5 py-1 bg-surface-container hover:bg-surface-container-high text-secondary font-mono text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
              title="Auto-fill with sample demonstration data"
            >
              <span className="material-symbols-outlined text-[15px]">auto_fix_high</span>
              <span>Fill Demo Sample</span>
            </button>
            <button
              onClick={() => onNavigate('staff')}
              className="text-on-surface-variant hover:text-primary p-1.5 rounded-full hover:bg-surface-container transition-colors"
              title="Staff Portal"
            >
              <span className="material-symbols-outlined text-xl">badge</span>
            </button>
          </div>
        </div>
      </header>

      {/* Step Indicator Banner */}
      <section className="bg-surface-container-lowest border-b border-outline-variant/30 px-4 md:px-6 pt-3 pb-3 w-full">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-secondary animate-pulse"></span>
            <span className="text-[11px] text-secondary uppercase font-bold tracking-wider font-mono">New OPD Registration</span>
          </div>
          <span className="font-mono text-xs text-on-surface-variant font-medium">Digital Intake</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-primary tracking-tight mb-0.5">Patient & Clinic Details</h1>
        <p className="text-xs text-on-surface-variant">Complete clinical triage check-in to secure your digital appointment token with live dynamic ETA.</p>
        <div className="w-full bg-surface-container rounded-full h-1.5 mt-2.5 overflow-hidden flex">
          <div className="bg-secondary h-full rounded-full w-2/3 transition-all duration-300"></div>
          <div className="bg-surface-container-high h-full w-1/3"></div>
        </div>
      </section>

      {/* Main Form Area (Responsive Grid on Tablet/Desktop) */}
      <main className="flex-1 w-full px-4 md:px-6 py-4 md:py-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-900 rounded-xl text-xs flex items-start gap-2 shadow-xs">
            <span className="material-symbols-outlined text-red-600 text-sm mt-0.5">error</span>
            <span>{error}</span>
          </div>
        )}

        <div className="md:grid md:grid-cols-12 md:gap-6 md:items-start space-y-4 md:space-y-0">
          {/* Left Column (Desktop): Department Selection Cards & Demo Assist */}
          <div className="md:col-span-5 flex flex-col gap-3.5">
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-primary flex items-center justify-between">
                <span>Select OPD Department</span>
                <span className="text-[10px] text-secondary font-mono">Real-Time Queues</span>
              </span>
              <p className="text-xs text-on-surface-variant">
                Select your consulting clinic. Live wait time and attending doctors update automatically.
              </p>
            </div>

            {/* Department Option Cards */}
            <div className="space-y-2">
              {[
                {
                  id: 'General Medicine' as OPDDepartment,
                  name: 'General Medicine',
                  room: 'Room 104',
                  doctor: 'Dr. Sarah Jenkins',
                  wait: genWait,
                  avgMins: 14,
                  icon: 'clinical_notes',
                },
                {
                  id: 'Cardiology' as OPDDepartment,
                  name: 'Cardiology',
                  room: 'Room 102',
                  doctor: 'Dr. Marcus Vance',
                  wait: cardWait,
                  avgMins: 12,
                  icon: 'cardiology',
                },
                {
                  id: 'Orthopaedics' as OPDDepartment,
                  name: 'Orthopaedics',
                  room: 'Room 105',
                  doctor: 'Dr. Keith Thorne',
                  wait: orthWait,
                  avgMins: 20,
                  icon: 'orthopedics',
                },
              ].map((dept) => {
                const isSelected = department === dept.id;
                return (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => setDepartment(dept.id)}
                    className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 interactive-card ${
                      isSelected
                        ? 'border-2 border-secondary bg-secondary-container/15 shadow-xs ring-1 ring-secondary/20'
                        : 'border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                        isSelected ? 'bg-secondary text-white' : 'bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">{dept.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${isSelected ? 'text-secondary' : 'text-primary'}`}>
                          {dept.name}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-container font-semibold text-primary">
                          {dept.wait} waiting
                        </span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant truncate mt-0.5">
                        {dept.doctor} • {dept.room}
                      </p>
                      <span className="text-[10px] text-secondary font-mono font-semibold block mt-1">
                        Est. Queue Wait: ~{dept.avgMins} mins
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Quick Demo Autofill Card */}
            <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-secondary text-sm">bolt</span>
                  <span>Hackathon Demo Helper</span>
                </span>
                <span className="text-[10px] text-secondary font-mono font-semibold">1-Click</span>
              </div>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                Need to quickly demonstrate patient registration without manual typing? Click below to fill a valid test record.
              </p>
              <button
                type="button"
                onClick={fillSampleDemoData}
                className="w-full py-2 px-3 bg-white hover:bg-surface-container border border-outline-variant rounded-lg text-xs font-semibold text-primary transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-[15px] text-secondary">auto_fix_high</span>
                <span>Fill Demo Sample (Aryan Verma)</span>
              </button>
            </div>
          </div>

          {/* Right Column (Desktop): Registration Form */}
          <div className="md:col-span-7">
            <form onSubmit={handleSubmit} className="space-y-4 bg-surface-container-lowest p-4 sm:p-5 rounded-2xl border border-outline-variant shadow-xs">
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
                    placeholder="e.g. Aryan"
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
                    placeholder="e.g. 28"
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
                      className="w-full h-10 pl-3 pr-8 rounded-lg border border-outline-variant bg-white text-on-surface text-sm appearance-none focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all cursor-pointer"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
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
                <div className="flex rounded-lg shadow-2xs">
                  <select
                    value={countryCode}
                    onChange={(e) => {
                      const newCode = e.target.value;
                      setCountryCode(newCode);
                      if (newCode === '+91') {
                        setContactNumber((prev) => cleanAndFormatIndianPhone(prev));
                      }
                    }}
                    className="inline-flex items-center px-2.5 rounded-l-lg border border-r-0 border-outline-variant bg-surface-container-low text-primary font-mono text-xs font-semibold focus:outline-none focus:border-secondary cursor-pointer"
                    title="Select Country Calling Code"
                    aria-label="Country calling code"
                  >
                    <option value="+91">🇮🇳 +91 (IN)</option>
                    <option value="+1">🇺🇸 +1 (US)</option>
                    <option value="+44">🇬🇧 +44 (UK)</option>
                  </select>
                  <input
                    id="contactNumber"
                    type="tel"
                    required
                    value={contactNumber}
                    onChange={(e) => {
                      if (countryCode === '+91') {
                        setContactNumber(cleanAndFormatIndianPhone(e.target.value));
                      } else {
                        setContactNumber(e.target.value);
                      }
                    }}
                    placeholder={countryCode === '+91' ? '98765 43210' : '(555) 234-8910'}
                    className="flex-1 min-w-0 block w-full h-10 px-3 rounded-none rounded-r-lg border border-outline-variant bg-white text-on-surface font-mono text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
                  />
                </div>
                <p className="text-[11px] text-on-surface-variant">
                  {countryCode === '+91'
                    ? 'Indian mobile format: +91 XXXXX XXXXX (10 digits). SMS alerts & token summons sent here.'
                    : 'Live token summons and SMS alert pings will be dispatched here.'}
                </p>
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
                  placeholder="e.g. SJH-IND-44102"
                  className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-white text-on-surface font-mono text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
                />
              </div>

              {/* 5. Chief Complaint */}
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

              {/* 6. Critical Allergies Toggle */}
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
                        className={`relative flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all active:scale-95 cursor-pointer ${
                          isSelected
                            ? 'border-2 border-secondary bg-secondary-container/20 text-secondary font-semibold'
                            : 'border-outline-variant bg-white text-on-surface hover:bg-surface-container-low'
                        }`}
                      >
                        <span className="material-symbols-outlined text-base mb-1">{item.icon}</span>
                        <span className="text-xs">{item.name}</span>
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
                  className="w-full h-11 bg-primary text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-xs hover:bg-primary-container active:scale-98 transition-all disabled:opacity-70 cursor-pointer"
                >
                  <span>{loading ? 'Processing Triage...' : 'Generate My Digital Token & Pass'}</span>
                  <span className="material-symbols-outlined text-secondary-fixed text-lg">arrow_forward</span>
                </button>
                <button
                  type="button"
                  onClick={onLookupToken}
                  className="w-full h-9 bg-transparent hover:bg-surface-container text-secondary text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">manage_search</span>
                  <span>Already registered? Look up Token</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation (Hidden on md+ screens) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-40 flex justify-around items-center px-2 py-1.5 pb-safe bg-surface-container-lowest shadow-sm max-w-md left-1/2 -translate-x-1/2 border-t border-outline-variant/40">
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
