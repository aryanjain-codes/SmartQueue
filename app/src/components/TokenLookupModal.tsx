import React, { useState } from 'react';
import { lookupTokenOrPatient } from '../services/api';
import { PatientQueueView } from '../types/queue';

interface TokenLookupModalProps {
  onClose: () => void;
  onPatientFound: (patient: PatientQueueView) => void;
  recentTokens?: Array<{ token: string; label: string }>;
}

export const TokenLookupModal: React.FC<TokenLookupModalProps> = ({ onClose, onPatientFound, recentTokens = [] }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (codeToSearch: string) => {
    if (!codeToSearch.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const patient = await lookupTokenOrPatient(codeToSearch);
      onPatientFound(patient);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || `No active record found for "${codeToSearch}".`);
    } finally {
      setLoading(false);
    }
  };

  const defaultTokens = [
    { token: 'MED-042', label: 'Eleanor Vance (Waiting)' },
    { token: 'MED-039', label: 'Arthur Pendelton (Serving)' },
    { token: 'MED-040', label: 'David Ross (Urgent)' },
    { token: 'CARD-013', label: 'Elena Gomez (Cardio)' },
    { token: 'ORTH-025', label: 'Samantha Reed (Ortho)' },
  ];

  // Merge recent tokens with default anchors, avoiding duplicates
  const displayedTokens = [
    ...recentTokens,
    ...defaultTokens.filter((d) => !recentTokens.some((r) => r.token === d.token)),
  ].slice(0, 7);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-primary/60 backdrop-blur-xs">
      <div className="w-full max-w-sm bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant overflow-hidden">
        <header className="px-4 py-3 bg-surface-container-low border-b border-outline-variant flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-xl">manage_search</span>
            <h3 className="font-bold text-sm text-primary">Look Up OPD Token</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </header>

        <div className="p-4 space-y-3.5">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 text-red-900 rounded-lg text-xs">
              {error}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch(query);
            }}
            className="space-y-2"
          >
            <label className="block text-xs font-semibold text-primary">
              Enter Ticket Token, Patient ID, or Pass ID
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. MED-042 or SJH-2025-8841"
                className="flex-1 h-10 px-3 bg-white border border-outline-variant rounded-lg text-xs font-mono uppercase focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
              />
              <button
                type="submit"
                disabled={loading}
                className="h-10 px-3.5 bg-secondary text-white rounded-lg text-xs font-semibold hover:bg-on-secondary-container transition-all active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Searching...' : 'Find'}
              </button>
            </div>
          </form>

          {/* Quick Click Samples */}
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-outline block mb-1.5 font-semibold">
              Quick Test Patient Tokens:
            </span>
            <div className="space-y-1">
              {displayedTokens.map((s) => (
                <button
                  key={s.token}
                  type="button"
                  onClick={() => handleSearch(s.token)}
                  className="w-full p-2 rounded-lg bg-surface hover:bg-surface-container border border-outline-variant/60 flex items-center justify-between text-xs transition-colors text-left"
                >
                  <span className="font-mono font-bold text-primary">{s.token}</span>
                  <span className="text-on-surface-variant text-[11px]">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
