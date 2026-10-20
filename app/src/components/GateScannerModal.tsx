import React, { useState } from 'react';
import { verifyPass } from '../services/api';
import { PatientRecord } from '../types/queue';

interface GateScannerModalProps {
  onClose: () => void;
  initialCode?: string;
}

export const GateScannerModal: React.FC<GateScannerModalProps> = ({ onClose, initialCode = '' }) => {
  const [inputCode, setInputCode] = useState(initialCode || 'SQ-PASS-90412-B');
  const [torchActive, setTorchActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [turnstileOpen, setTurnstileOpen] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  // Initialize camera if supported
  React.useEffect(() => {
    let active = true;

    async function initCamera() {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
            audio: false,
          });
          if (active && videoRef.current) {
            videoRef.current.srcObject = stream;
            streamRef.current = stream;
            setCameraActive(true);
            setCameraError(null);
          }
        } catch (err: any) {
          // Camera permission denied, unsupported, or blocked by iframe policy
          console.warn('Physical camera unavailable (using optical reticle simulator):', err?.message || err);
          if (active) {
            setCameraActive(false);
            setCameraError(err?.name === 'NotAllowedError' ? 'Camera permission blocked by browser/iframe' : null);
          }
        }
      }
    }

    initCamera();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Result state
  const [outcome, setOutcome] = useState<'VALID' | 'EXPIRED' | 'REVOKED' | 'INVALID'>('VALID');
  const [patient, setPatient] = useState<PatientRecord | null>({
    id: 'SJH-2025-8841',
    token: 'MED-042',
    passId: 'SQ-PASS-90412-B',
    passExpiry: new Date(Date.now() + 29 * 24 * 60 * 60 * 1000).toISOString(),
    fullName: 'Eleanor Vance',
    age: 34,
    gender: 'Female',
    contactNumber: '(555) 234-8910',
    department: 'General Medicine',
    room: 'Room 104',
    doctor: 'Dr. Sarah Jenkins, MD',
    chiefComplaint: 'Mild recurrent migraine and photophobia for 3 days',
    allergies: ['Penicillin', 'Sulfa Drugs'],
    status: 'WAITING',
    triageSeverity: 'Routine',
    location: 'Waiting Hall B',
    registeredAt: new Date().toISOString(),
  });
  const [auditLog, setAuditLog] = useState([
    { token: 'MED-042', name: 'Eleanor Vance', outcome: 'Valid', time: '10:14 AM' },
    { token: 'MED-039', name: 'Arthur Pendelton', outcome: 'Valid', time: '10:11 AM' },
    { token: 'CARD-012', name: 'Marcus Brody', outcome: 'Valid', time: '10:07 AM' },
  ]);

  const handleVerify = async (codeToVerify: string) => {
    if (!codeToVerify.trim()) return;
    setScanning(true);
    try {
      const res = await verifyPass(codeToVerify);
      setOutcome(res.outcome);
      if (res.patient) {
        setPatient(res.patient);
      }
      // Add to audit trail
      setAuditLog((prev) => [
        {
          token: res.patient ? res.patient.token : codeToVerify.substring(0, 8),
          name: res.patient ? res.patient.fullName : 'Guest Scanner',
          outcome: res.outcome === 'VALID' ? 'Valid' : res.outcome === 'EXPIRED' ? 'Expired' : 'Rejected',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
        ...prev.slice(0, 4),
      ]);
    } catch (err) {
      console.error(err);
      setOutcome('INVALID');
    } finally {
      setScanning(false);
    }
  };

  const handleOpenTurnstile = () => {
    setTurnstileOpen(true);
    setTimeout(() => {
      setTurnstileOpen(false);
    }, 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-primary/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant overflow-hidden my-auto max-h-[95vh] flex flex-col">
        {/* Hardware Status Strip */}
        <div className="w-full bg-primary-container px-4 py-1 flex items-center justify-between text-on-primary-container text-[11px] select-none border-b border-primary/40">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-secondary-fixed animate-pulse"></span>
            <span className="font-mono text-[10px] uppercase font-semibold text-primary-fixed">Kiosk-Online</span>
            <span className="text-outline text-[10px]">|</span>
            <span className="text-primary-fixed-dim text-[10px]">99.8% Sync</span>
          </div>
          <div className="flex items-center gap-2 text-primary-fixed font-mono text-[10px]">
            <span>98%</span>
            <span className="material-symbols-outlined text-[14px]">battery_full</span>
            <span className="material-symbols-outlined text-[14px]">wifi</span>
          </div>
        </div>

        {/* Header */}
        <header className="bg-surface-container-lowest border-b border-outline-variant px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center text-white">
              <span className="material-symbols-outlined text-[20px] text-secondary-fixed">local_hospital</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-primary tracking-tight leading-none">SmartQueue Gate Scanner</h2>
              <span className="text-[10px] text-secondary font-bold tracking-wider uppercase mt-0.5 block">
                Security Terminal #02 • Gate 02
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </header>

        {/* Scrollable Viewport */}
        <div className="overflow-y-auto p-4 space-y-3.5 flex-1">
          {/* Camera Viewport Simulation / Live Feed */}
          <div className="w-full relative bg-primary rounded-xl overflow-hidden shadow-md border border-outline/30 flex flex-col items-center justify-center aspect-[4/3] max-h-56">
            {/* Real Video Element if camera stream active */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                cameraActive ? 'opacity-90' : 'opacity-0 pointer-events-none'
              }`}
            />

            {!cameraActive && (
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#6bd8cb_1px,transparent_1px)] bg-[size:16px_16px]"></div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-transparent to-primary/80 pointer-events-none"></div>

            {/* Top camera toolbar */}
            <div className="absolute top-2.5 inset-x-3 flex justify-between items-center z-20">
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-container/80 border border-primary-fixed-dim/20">
                <span className="w-2 h-2 rounded-full bg-error animate-ping"></span>
                <span className="text-[9px] font-mono text-primary-fixed uppercase font-semibold">
                  {cameraActive ? 'Live Sensor Feed' : 'Optical Cam 01'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setTorchActive(!torchActive)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors ${
                    torchActive ? 'bg-secondary text-white' : 'bg-primary-container/80 text-primary-fixed hover:bg-primary-container'
                  }`}
                  title="Flashlight"
                >
                  <span className="material-symbols-outlined text-[16px]">flash_on</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleVerify(inputCode)}
                  className="w-7 h-7 rounded-lg bg-primary-container/80 text-primary-fixed flex items-center justify-center hover:bg-primary-container"
                  title="Trigger Optical Scan"
                >
                  <span className="material-symbols-outlined text-[16px]">scan</span>
                </button>
              </div>
            </div>

            {/* Reticle with Corner Brackets */}
            <div className="relative w-40 h-40 z-10 flex items-center justify-center pointer-events-none">
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-5 h-5 border-t-[3px] border-l-[3px] border-secondary-fixed rounded-tl-xs"></div>
              <div className="absolute top-0 right-0 w-5 h-5 border-t-[3px] border-r-[3px] border-secondary-fixed rounded-tr-xs"></div>
              <div className="absolute bottom-0 left-0 w-5 h-5 border-b-[3px] border-l-[3px] border-secondary-fixed rounded-bl-xs"></div>
              <div className="absolute bottom-0 right-0 w-5 h-5 border-b-[3px] border-r-[3px] border-secondary-fixed rounded-br-xs"></div>

              {/* Scanning laser line */}
              <div className="absolute w-full h-1 bg-gradient-to-r from-transparent via-secondary-fixed to-transparent shadow-[0_0_12px_#89f5e7] animate-pulse"></div>

              {!cameraActive && (
                <div className="w-28 h-28 border border-secondary-fixed/20 rounded flex flex-col items-center justify-center bg-primary-container/30">
                  <span className="material-symbols-outlined text-[42px] text-secondary-fixed/40">qr_code_scanner</span>
                  <span className="text-[9px] font-mono text-primary-fixed-dim/70 mt-1 uppercase font-semibold">ISO-18004 2D</span>
                </div>
              )}
            </div>

            <div className="absolute bottom-2 inset-x-4 text-center z-20">
              <span className="inline-block px-3 py-0.5 bg-primary-container/90 rounded-full border border-primary-fixed-dim/20 text-[10px] text-primary-fixed font-medium">
                {cameraActive ? 'Align 30-Day QR Pass within focus frame' : cameraError ? 'Optical Cam Simulated (Webcam blocked)' : 'Align 30-Day QR Pass or Token within target'}
              </span>
            </div>
          </div>

          {/* Manual Entry Fallback */}
          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-3 shadow-xs">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-primary flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-secondary">keyboard</span>
                Manual Fallback Entry
              </label>
              <span className="text-[10px] font-mono text-on-surface-variant uppercase">Alphanumeric</span>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleVerify(inputCode);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                placeholder="e.g. SQ-PASS-90412-B or MED-042"
                className="flex-1 h-9 px-3 bg-white border border-outline-variant rounded-lg text-primary text-xs font-mono uppercase focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
              />
              <button
                type="submit"
                disabled={scanning}
                className="h-9 px-3.5 bg-primary hover:bg-primary-container text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 shadow-xs whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[16px]">verified</span>
                <span>{scanning ? 'Checking...' : 'Verify'}</span>
              </button>
            </form>
          </section>

          {/* Verification Outcome Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-primary flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-secondary">security_update_good</span>
                Verification Outcome
              </h4>
              <span className="text-[10px] font-mono text-outline font-semibold">Live System Match</span>
            </div>

            {/* VALID OUTCOME */}
            {outcome === 'VALID' && (
              <div className="relative bg-surface-container-lowest border-2 border-secondary rounded-xl overflow-hidden shadow-xs p-3 pl-4">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-secondary"></div>
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-outline-variant">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-secondary-container/40 flex items-center justify-center text-secondary">
                      <span className="material-symbols-outlined text-[16px] font-bold">check_circle</span>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-secondary uppercase tracking-wide block">
                        VALID PASS - ACCESS GRANTED
                      </span>
                      <span className="text-[10px] font-mono text-on-surface-variant">Clearance: Tier-1 Ambulatory</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-secondary-container/40 text-on-secondary-container font-mono text-[10px] font-bold border border-secondary/30">
                    ACTIVE
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-left mb-2 text-xs">
                  <div>
                    <span className="text-[9px] uppercase text-on-surface-variant block font-medium">Authorized Patient</span>
                    <p className="font-bold text-primary truncate">{patient?.fullName || 'Eleanor Vance'}</p>
                    <span className="text-[10px] font-mono text-outline">
                      Token: <strong className="text-secondary">{patient?.token || 'MED-042'}</strong>
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase text-on-surface-variant block font-medium">Designated OPD Desk</span>
                    <p className="font-semibold text-primary truncate">{patient?.department || 'General Medicine'}</p>
                    <span className="text-[10px] font-mono text-secondary font-bold">{patient?.room || 'Room 104'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-outline-variant bg-surface-container-low/50 -mx-3 -mb-3 px-3 py-2 text-[11px]">
                  <span className="text-on-surface-variant font-mono text-[10px]">
                    Expiry: <strong className="text-primary font-semibold">30 Days Active</strong>
                  </span>
                  <button
                    onClick={handleOpenTurnstile}
                    className={`px-3 py-1 rounded text-[11px] font-semibold transition-all active:scale-95 flex items-center gap-1 shadow-xs ${
                      turnstileOpen
                        ? 'bg-emerald-600 text-white'
                        : 'bg-secondary text-white hover:bg-on-secondary-container'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">door_open</span>
                    <span>{turnstileOpen ? 'Turnstile Unlocked!' : 'Open Turnstile'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* EXPIRED OUTCOME */}
            {outcome === 'EXPIRED' && (
              <div className="relative bg-surface-container-lowest border-2 border-amber-600 rounded-xl overflow-hidden shadow-xs p-3 pl-4">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-600"></div>
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-outline-variant">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-amber-700">history_toggle_off</span>
                    <div>
                      <span className="text-xs font-bold text-amber-800 uppercase tracking-wide block">
                        EXPIRED PASS - ACCESS DENIED
                      </span>
                      <span className="text-[10px] font-mono text-outline">Clearance Lapsed (Over 30 Days)</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-mono text-[10px] font-bold">
                    EXPIRED
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant mb-2">
                  Visitor pass period has expired. Please instruct patient to visit the central kiosk to generate a new OPD token.
                </p>
              </div>
            )}

            {/* REVOKED OUTCOME */}
            {outcome === 'REVOKED' && (
              <div className="relative bg-surface-container-lowest border-2 border-error rounded-xl overflow-hidden shadow-xs p-3 pl-4">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-error"></div>
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-red-200">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-error">gavel</span>
                    <div>
                      <span className="text-xs font-bold text-error uppercase tracking-wide block">
                        FLAGGED - ENTRY RESTRICTED
                      </span>
                      <span className="text-[10px] font-mono text-error">Revocation Code: SEC-FLAG-99</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-error text-white font-mono text-[10px] font-bold">
                    REVOKED
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant mb-2">
                  Pass revoked by Infection Control / Chief Triage. Escort visitor to External Screening Tent 03.
                </p>
              </div>
            )}

            {/* INVALID PAYLOAD */}
            {outcome === 'INVALID' && (
              <div className="relative bg-surface-container-lowest border-2 border-outline-variant rounded-xl overflow-hidden shadow-xs p-3 pl-4">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-outline"></div>
                <div className="flex items-center justify-between pb-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-outline">qr_code_2</span>
                    <div>
                      <span className="text-xs font-bold text-primary uppercase tracking-wide block">
                        INVALID QR PAYLOAD
                      </span>
                      <span className="text-[10px] font-mono text-outline">Non-SmartQueue Barcode Schema</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-mono text-[10px] font-bold">
                    UNRECOGNIZED
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant">
                  Scanned code does not match St. Jude Memorial Hospital PKI schemas. Ensure patient is presenting an official SmartQueue pass.
                </p>
              </div>
            )}
          </div>

          {/* Test chips */}
          <div className="pt-1">
            <span className="text-[10px] font-mono uppercase text-outline tracking-wider font-semibold block mb-1">
              Simulation Trigger / Test Scenarios:
            </span>
            <div className="grid grid-cols-4 gap-1 text-[10px] font-mono">
              <button
                type="button"
                onClick={() => handleVerify('SQ-PASS-90412-B')}
                className="py-1 px-1 rounded bg-secondary-container/30 border border-secondary text-secondary font-semibold hover:bg-secondary-container"
              >
                Valid Pass
              </button>
              <button
                type="button"
                onClick={() => handleVerify('EXP-PASS-88401')}
                className="py-1 px-1 rounded bg-amber-50 border border-amber-300 text-amber-800 font-semibold hover:bg-amber-100"
              >
                Expired (30d+)
              </button>
              <button
                type="button"
                onClick={() => handleVerify('FLAG-PASS-9901')}
                className="py-1 px-1 rounded bg-red-50 border border-red-300 text-error font-semibold hover:bg-red-100"
              >
                Revoked Gate
              </button>
              <button
                type="button"
                onClick={() => handleVerify('RANDOM-TICKET-44')}
                className="py-1 px-1 rounded bg-surface-container border border-outline-variant text-on-surface hover:bg-surface-container-high"
              >
                Invalid QR
              </button>
            </div>
          </div>

          {/* Audit Log */}
          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-3 shadow-xs">
            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-outline-variant text-xs">
              <span className="font-bold text-primary flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">receipt_long</span>
                Recent Scans (Gate Audit Trail)
              </span>
              <span className="text-[10px] font-mono text-secondary font-semibold">Live Feed</span>
            </div>
            <ul className="space-y-1 text-xs font-mono">
              {auditLog.map((item, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between p-1.5 rounded bg-surface-container-low border border-outline-variant/60"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        item.outcome === 'Valid' ? 'bg-secondary' : item.outcome === 'Expired' ? 'bg-amber-600' : 'bg-error'
                      }`}
                    ></span>
                    <span className="font-bold text-primary">{item.token}</span>
                    <span className="text-on-surface-variant text-[10px]">({item.name})</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span
                      className={`px-1 py-0.2 rounded font-bold uppercase text-[9px] ${
                        item.outcome === 'Valid'
                          ? 'bg-secondary-container/40 text-on-secondary-container'
                          : 'bg-error-container text-error'
                      }`}
                    >
                      {item.outcome}
                    </span>
                    <span className="text-outline">{item.time}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};
