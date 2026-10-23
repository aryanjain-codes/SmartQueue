import React, { useState } from 'react';
import { staffLogin, StaffSession } from '../services/api';

interface StaffLoginViewProps {
  initialRole?: 'clinical' | 'security';
  onLoginSuccess: (session: StaffSession) => void;
  onNavigateHome: () => void;
}

export const StaffLoginView: React.FC<StaffLoginViewProps> = ({
  initialRole = 'clinical',
  onLoginSuccess,
  onNavigateHome,
}) => {
  const [selectedRole, setSelectedRole] = useState<'clinical' | 'security'>(initialRole);
  const [username, setUsername] = useState(
    initialRole === 'clinical' ? 'dr.jenkins' : 'officer.briggs'
  );
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRoleChange = (role: 'clinical' | 'security') => {
    setSelectedRole(role);
    setUsername(role === 'clinical' ? 'dr.jenkins' : 'officer.briggs');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please provide both username and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const session = await staffLogin({
        username: username.trim(),
        password,
      });

      onLoginSuccess(session);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your staff credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant overflow-hidden">
        {/* Top Header */}
        <div className="bg-primary px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center text-secondary-fixed shadow-sm">
              <span className="material-symbols-outlined text-2xl">local_hospital</span>
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white leading-tight">
                Staff Authentication Portal
              </h1>
              <p className="text-[11px] font-mono text-primary-fixed-dim">
                St. Jude Memorial Hospital OPD
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onNavigateHome}
            className="p-1.5 rounded-lg text-primary-fixed-dim hover:text-white hover:bg-white/10 transition-colors"
            title="Return to Public Landing"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5">
          {/* Role Tabs */}
          <div className="grid grid-cols-2 p-1 bg-surface-container-low rounded-xl border border-outline-variant/60 gap-1">
            <button
              type="button"
              onClick={() => handleRoleChange('clinical')}
              className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                selectedRole === 'clinical'
                  ? 'bg-secondary text-white shadow-xs'
                  : 'text-on-surface-variant hover:text-primary hover:bg-white/60'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">stethoscope</span>
              <span>Clinical Doctor</span>
            </button>
            <button
              type="button"
              onClick={() => handleRoleChange('security')}
              className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                selectedRole === 'security'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-on-surface-variant hover:text-primary hover:bg-white/60'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">shield</span>
              <span>Gate Security</span>
            </button>
          </div>

          {/* Role description banner */}
          <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/60 text-xs text-on-surface-variant leading-relaxed">
            {selectedRole === 'clinical' ? (
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-secondary text-base mt-0.5 shrink-0">
                  clinical_notes
                </span>
                <span>
                  <strong>Clinical Physician Access:</strong> Grants full clearance to outpatient rosters, patient EHR records, consultations, and call-next controls.
                </span>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-amber-600 text-base mt-0.5 shrink-0">
                  security
                </span>
                <span>
                  <strong>Security Gate Access:</strong> Grants Zero-Knowledge clearance for 30-day QR gate verification, entrance logs, and pass status administration.
                </span>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-900 rounded-xl text-xs flex items-start gap-2 shadow-xs">
              <span className="material-symbols-outlined text-red-600 text-base mt-0.5 shrink-0">
                error
              </span>
              <span className="leading-snug">{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-primary mb-1">
                Staff Username / ID
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={selectedRole === 'clinical' ? 'dr.jenkins' : 'officer.briggs'}
                  className="w-full h-10 px-3 pl-9 bg-white border border-outline-variant rounded-lg text-xs font-medium text-primary focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
                />
                <span className="material-symbols-outlined text-outline text-[18px] absolute left-2.5 top-2.5 pointer-events-none">
                  person
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-primary mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter secure staff password"
                  className="w-full h-10 px-3 pl-9 pr-9 bg-white border border-outline-variant rounded-lg text-xs font-medium text-primary focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
                />
                <span className="material-symbols-outlined text-outline text-[18px] absolute left-2.5 top-2.5 pointer-events-none">
                  lock
                </span>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2.5 text-outline hover:text-primary transition-colors"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2.5 px-4 text-white rounded-lg text-xs font-semibold transition-all shadow-xs flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 ${
                selectedRole === 'clinical'
                  ? 'bg-secondary hover:bg-on-secondary-container'
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              <span className="material-symbols-outlined text-base">login</span>
              <span>{loading ? 'Authenticating...' : 'Sign In to Protected Station'}</span>
            </button>
          </form>

          {/* Demo Credentials Helper Pill */}
          <div className="pt-2 border-t border-outline-variant/50">
            <div className="bg-surface-container-low p-2.5 rounded-lg border border-outline-variant/60 flex items-start gap-2 text-[11px] text-on-surface-variant font-mono">
              <span className="material-symbols-outlined text-primary text-[15px] shrink-0 mt-0.5">
                key
              </span>
              <div className="space-y-0.5 leading-snug">
                <div>
                  <strong>Demo Doctor:</strong> <span className="text-secondary">dr.jenkins</span> / <span className="text-secondary">ClinicalDoc#2026</span>
                </div>
                <div>
                  <strong>Demo Security:</strong> <span className="text-amber-700">officer.briggs</span> / <span className="text-amber-700">GateSecurity#2026</span>
                </div>
              </div>
            </div>
          </div>

          {/* Return Home */}
          <button
            type="button"
            onClick={onNavigateHome}
            className="w-full py-2 text-xs font-semibold text-on-surface-variant hover:text-primary flex items-center justify-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            <span>Return to Hospital Public Portal</span>
          </button>
        </div>
      </div>
    </div>
  );
};
