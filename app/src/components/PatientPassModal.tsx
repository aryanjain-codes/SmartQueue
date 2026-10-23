import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { PatientRecord } from '../types/queue';
import { updatePassStatus } from '../services/api';

interface PatientPassModalProps {
  patient: PatientRecord;
  onClose: () => void;
  onOpenScanner?: (code?: string) => void;
}

export const PatientPassModal: React.FC<PatientPassModalProps> = ({
  patient,
  onClose,
  onOpenScanner,
}) => {
  const [passState, setPassState] = useState<'active' | 'expired' | 'revoked'>(
    patient.passStatus || 'active'
  );
  const [walletSaved, setWalletSaved] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  // The pass token is ALWAYS this patient's unique, persistent 128-bit pass ID
  const currentPassToken = patient.passId;

  // Generate dynamic QR code encoding ONLY the opaque pass token
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(
      currentPassToken,
      {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 240,
        color: {
          dark: '#001428',
          light: '#ffffff',
        },
      },
      (err, url) => {
        if (!err && url && active) {
          setQrDataUrl(url);
        }
      }
    );
    return () => {
      active = false;
    };
  }, [currentPassToken]);

  const handleStatusChange = async (newState: 'active' | 'expired' | 'revoked') => {
    setPassState(newState);
    setStatusUpdating(true);
    setStatusFeedback(null);
    try {
      await updatePassStatus(patient.passId, newState);
      setStatusFeedback(`Server updated status: ${newState.toUpperCase()}`);
      setTimeout(() => setStatusFeedback(null), 3500);
    } catch (err: any) {
      console.warn('Could not sync pass status to server:', err);
    } finally {
      setStatusUpdating(false);
    }
  };

  const expiryDate = new Date(
    passState === 'expired'
      ? Date.now() - 5 * 24 * 60 * 60 * 1000
      : patient.passExpiry || Date.now() + 30 * 24 * 60 * 60 * 1000
  );

  const formattedExpiry = expiryDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-primary/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-[430px] bg-background rounded-2xl shadow-2xl border border-outline-variant overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-surface-container-lowest px-4 py-3 flex items-center justify-between border-b border-outline-variant/60">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-surface-container text-primary transition-colors active:scale-95"
              aria-label="Back"
            >
              <span className="material-symbols-outlined text-[22px]">arrow_back</span>
            </button>
            <div>
              <h3 className="font-bold text-sm text-primary tracking-tight">Hospital Access Pass</h3>
              <p className="text-[11px] text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px] text-secondary">security_update_good</span>
                St. Jude Memorial Hospital
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => window.print()}
              className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors"
              title="Print Badge"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-surface-container transition-colors"
              title="Close"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-4 space-y-4">
          {/* State selector */}
          <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-2.5 shadow-xs">
            <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-outline-variant/30 px-1">
              <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">
                GATE SCANNER RECOGNITION STATE
              </span>
              <span className="text-[10px] text-secondary font-semibold">TAP TO PREVIEW</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                disabled={statusUpdating}
                onClick={() => handleStatusChange('active')}
                className={`py-1.5 px-1 rounded-lg text-center transition-all ${
                  passState === 'active'
                    ? 'border-2 border-secondary bg-secondary-container/20 text-secondary font-semibold'
                    : 'border border-outline-variant/60 bg-surface text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                <div className="flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                  <span className="text-[11px]">ACTIVE</span>
                </div>
                <span className="text-[9px] block text-on-surface-variant opacity-80">30-Day Clearance</span>
              </button>
              <button
                type="button"
                disabled={statusUpdating}
                onClick={() => handleStatusChange('expired')}
                className={`py-1.5 px-1 rounded-lg text-center transition-all ${
                  passState === 'expired'
                    ? 'border-2 border-amber-600 bg-amber-50 text-amber-800 font-semibold'
                    : 'border border-outline-variant/60 bg-surface text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                <span className="text-[11px] block">EXPIRED</span>
                <span className="text-[9px] block text-on-surface-variant opacity-80">Re-Checkin Req.</span>
              </button>
              <button
                type="button"
                disabled={statusUpdating}
                onClick={() => handleStatusChange('revoked')}
                className={`py-1.5 px-1 rounded-lg text-center transition-all ${
                  passState === 'revoked'
                    ? 'border-2 border-error bg-red-50 text-error font-semibold'
                    : 'border border-outline-variant/60 bg-surface text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                <span className="text-[11px] block">REVOKED</span>
                <span className="text-[9px] block text-error/80">Flagged Gate</span>
              </button>
            </div>
            {statusFeedback && (
              <div className="mt-1.5 text-[10px] text-center font-mono text-secondary animate-fadeIn">
                ✓ {statusFeedback}
              </div>
            )}
          </section>

          {/* Digital Badge Card */}
          <div className="relative bg-surface-container-lowest rounded-xl border border-outline-variant shadow-md overflow-hidden">
            {/* Hologram strip */}
            <div className="h-2 w-full bg-gradient-to-r from-emerald-200 via-cyan-200 to-teal-300 opacity-80"></div>

            {/* Badge Header */}
            <div className="bg-primary-container px-3.5 py-2.5 text-white flex items-center justify-between border-b border-primary">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-white text-primary flex items-center justify-center font-bold text-xs">
                  <span className="material-symbols-outlined text-[16px] text-primary">local_hospital</span>
                </div>
                <div>
                  <p className="text-xs font-bold leading-tight">St. Jude Memorial Hospital</p>
                  <p className="text-[9px] text-secondary-fixed tracking-wider uppercase">OPD FAST-TRACK PASS</p>
                </div>
              </div>
              <span className="px-1.5 py-0.5 rounded bg-white/10 border border-white/20 text-[9px] font-mono tracking-wider">
                GATE-ACCESS
              </span>
            </div>

            {/* Badge Body */}
            <div className="p-3.5 space-y-3">
              {/* Status pill & Pass ID */}
              <div className="flex items-center justify-between">
                <div>
                  {passState === 'active' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      ACTIVE & VALID
                    </span>
                  )}
                  {passState === 'expired' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                      <span className="material-symbols-outlined text-[12px]">history</span>
                      EXPIRED (Requires Re-checkin)
                    </span>
                  )}
                  {passState === 'revoked' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-red-50 border border-red-200 text-red-800 text-[11px] font-semibold">
                      <span className="material-symbols-outlined text-[12px]">report</span>
                      REVOKED / INVALID
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-on-surface-variant block uppercase tracking-wide">PASS IDENTIFIER</span>
                  <span className="font-mono text-xs font-bold text-primary truncate max-w-[150px] inline-block" title={currentPassToken}>
                    {currentPassToken}
                  </span>
                </div>
              </div>

              {/* Dynamic QR Code Container */}
              <div className="relative bg-surface-container-low/60 border border-outline-variant/60 rounded-xl p-3 flex flex-col items-center justify-center">
                <div className="w-44 h-44 bg-white p-2 rounded-lg border border-outline-variant shadow-inner flex items-center justify-center relative">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={`Dynamic QR Pass: ${currentPassToken}`}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="animate-pulse text-xs text-on-surface-variant font-mono">
                      Generating Dynamic QR...
                    </div>
                  )}

                  {/* Overlays if Expired or Revoked */}
                  {passState !== 'active' && (
                    <div className="absolute inset-0 bg-white/95 backdrop-blur-xs flex flex-col items-center justify-center p-2 text-center rounded-lg">
                      <span className={`material-symbols-outlined text-3xl mb-1 ${passState === 'expired' ? 'text-amber-700' : 'text-error'}`}>
                        {passState === 'expired' ? 'history' : 'block'}
                      </span>
                      <span className={`text-xs font-bold leading-tight ${passState === 'expired' ? 'text-amber-800' : 'text-error'}`}>
                        {passState === 'expired' ? 'PASS EXPIRED' : 'ACCESS REVOKED'}
                      </span>
                      <span className="text-[10px] text-on-surface-variant mt-0.5">Report to Central OPD Desk</span>
                    </div>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-on-surface-variant text-[11px]">
                  <span className="material-symbols-outlined text-[14px] text-secondary">qr_code_scanner</span>
                  <span>Dynamic QR: Encodes opaque token only</span>
                </div>
              </div>

              {/* Patient & Validity Details Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded bg-surface border border-outline-variant/60">
                  <span className="text-[10px] text-on-surface-variant block uppercase font-medium">Patient Name</span>
                  <p className="font-bold text-primary text-sm truncate">{patient.fullName}</p>
                  <span className="text-[10px] font-mono text-outline block mt-0.5">
                    Token: <strong className="text-secondary">{patient.token}</strong> • {patient.id}
                  </span>
                </div>
                <div className="p-2 rounded bg-surface border border-outline-variant/60">
                  <span className="text-[10px] text-on-surface-variant block uppercase font-medium">Emergency Contact</span>
                  <p className="font-semibold text-secondary text-xs truncate mt-0.5">{patient.contactNumber}</p>
                  <span className="text-[10px] text-on-surface-variant block mt-0.5">Primary Next-of-Kin</span>
                </div>
                <div className="col-span-2 p-2 rounded bg-surface border border-outline-variant/60 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-on-surface-variant block uppercase font-medium">Valid Period</span>
                    <span className="font-mono text-xs text-primary font-semibold">
                      {todayFormatted} → {formattedExpiry}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-secondary-container/30 text-secondary border border-secondary-container">
                    {passState === 'active' ? '30 Days Pass' : 'Lapsed'}
                  </span>
                </div>
              </div>

              {/* Zero-Knowledge Privacy Banner */}
              <div className="p-2.5 rounded-lg bg-surface-container-low border-l-4 border-secondary border border-outline-variant/40">
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-secondary text-[16px] shrink-0 mt-0.5">lock</span>
                  <div>
                    <p className="text-[11px] font-bold text-primary">Zero-Knowledge Health Pass</p>
                    <p className="text-[10px] text-on-surface-variant leading-relaxed mt-0.5">
                      For patient privacy & HIPAA compliance, clinical records, complaints, and allergies are <strong className="text-primary font-semibold">NEVER</strong> embedded in this QR barcode.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Microprint Footer */}
            <div className="bg-surface-container-low px-3 py-1.5 border-t border-outline-variant/40 flex items-center justify-between text-[9px] text-on-surface-variant font-mono">
              <span>Property of St. Jude OPD Health System</span>
              <span>Form SQ-MED-V4</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <button
              onClick={() => {
                setWalletSaved(true);
                setTimeout(() => setWalletSaved(false), 3000);
              }}
              className={`w-full h-10 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-xs ${
                walletSaved
                  ? 'bg-emerald-600 text-white'
                  : 'bg-primary text-white hover:bg-primary-container active:scale-95'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {walletSaved ? 'check_circle' : 'account_balance_wallet'}
              </span>
              <span>{walletSaved ? `Pass Saved to Wallet ✓` : 'Save to Apple Wallet / Google Wallet'}</span>
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => window.print()}
                className="h-9 bg-white border border-outline text-primary rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-surface-container active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[16px] text-secondary">picture_as_pdf</span>
                <span>Print PDF Badge</span>
              </button>
              {onOpenScanner && (
                <button
                  onClick={() => onOpenScanner(currentPassToken)}
                  className="h-9 bg-secondary text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-on-secondary-container active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">qr_code_scanner</span>
                  <span>Test at Gate Scanner</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
