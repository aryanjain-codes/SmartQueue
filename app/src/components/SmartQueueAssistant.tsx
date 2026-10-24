import React, { useState, useEffect, useRef } from 'react';
import { AssistantQuestion, AssistantFaqResponse } from '../types/assistant';
import { fetchAssistantQuestions, askAssistantQuestion } from '../services/api';

interface SmartQueueAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  patientToken?: string;
  patientPassId?: string;
  patientDepartment?: string;
}

const CATEGORIES: Array<{ id: 'all' | 'queue' | 'priority' | 'status' | 'general'; label: string; icon: string }> = [
  { id: 'all', label: 'All Topics', icon: 'apps' },
  { id: 'queue', label: 'Wait & Delay', icon: 'schedule' },
  { id: 'priority', label: 'Triage Priority', icon: 'emergency' },
  { id: 'status', label: 'Token Status', icon: 'badge' },
  { id: 'general', label: 'Hospital Guide', icon: 'local_hospital' },
];

export const SmartQueueAssistant: React.FC<SmartQueueAssistantProps> = ({
  isOpen,
  onClose,
  patientToken,
  patientPassId,
  patientDepartment,
}) => {
  const [questions, setQuestions] = useState<AssistantQuestion[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<AssistantQuestion | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [conversation, setConversation] = useState<
    Array<{
      question: AssistantQuestion;
      response: AssistantFaqResponse;
    }>
  >([]);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'queue' | 'priority' | 'status' | 'general'>('all');

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Load allowlisted questions on mount
  useEffect(() => {
    fetchAssistantQuestions()
      .then((qs) => setQuestions(qs))
      .catch((err) => {
        console.warn('Could not fetch questions from server:', err);
      });
  }, []);

  // Keyboard accessibility: Escape closes modal & focus trap management
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    closeButtonRef.current?.focus();

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Scroll to bottom when conversation updates
  useEffect(() => {
    if (conversation.length > 0) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversation, loading]);

  const categoryCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: questions.length };
    for (const q of questions) {
      counts[q.category] = (counts[q.category] || 0) + 1;
    }
    return counts;
  }, [questions]);

  const filteredQuestions = selectedCategory === 'all'
    ? questions
    : questions.filter((q) => q.category === selectedCategory);

  const handleSelectQuestion = async (q: AssistantQuestion) => {
    setSelectedQuestion(q);
    setLoading(true);
    setError(null);

    try {
      const response = await askAssistantQuestion({
        questionId: q.id,
        token: patientToken,
        passId: patientPassId,
      });

      setConversation((prev) => [...prev, { question: q, response }]);
    } catch (err: any) {
      console.error('Assistant error:', err);
      setError(err?.message || 'Unable to connect to SmartQueue Assistant.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    setConversation([]);
    setSelectedQuestion(null);
    setError(null);
  };

  // Safe early return ONLY after all hooks (useState, useRef, useEffect, useMemo) have executed
  if (!isOpen) return null;

  // Predefined Selectable Questions Section (Strictly No Free-Text Input)
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-primary/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assistant-dialog-title"
      ref={dialogRef}
    >
      <div className="w-full max-w-lg md:max-w-xl bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <header className="px-4 py-3 bg-surface-container-low border-b border-outline-variant flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-secondary text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[20px]">smart_toy</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="assistant-dialog-title" className="font-bold text-sm text-primary tracking-tight">
                  SmartQueue Assistant
                </h2>
                <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                  AI Powered
                </span>
              </div>
              <p className="text-[10px] text-on-surface-variant font-mono">
                St. Jude OPD FAQ & Live Telemetry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {conversation.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="px-2 py-1 text-[11px] font-medium text-on-surface-variant hover:text-primary rounded-md hover:bg-surface-container transition-colors"
                title="Reset conversation"
                aria-label="Reset conversation"
              >
                Clear
              </button>
            )}
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors"
              aria-label="Close SmartQueue Assistant"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </header>

        {/* Authenticated Patient Context Banner */}
        {patientToken && (
          <div className="bg-surface-container-lowest px-4 py-2 border-b border-outline-variant/40 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[11px] text-on-surface-variant">
                Authenticated Pass: <strong className="text-primary font-mono">{patientToken}</strong>
                {patientDepartment ? ` • ${patientDepartment}` : ''}
              </span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary-container/40 text-secondary font-semibold font-mono">
              Verified EHR Linked
            </span>
          </div>
        )}

        {/* Main Content Area (Scrollable) */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Welcome Message */}
          <div className="flex items-start gap-2.5 bg-surface-container-low p-3.5 rounded-xl border border-outline-variant/40">
            <div className="w-6 h-6 rounded-full bg-secondary-container text-secondary flex items-center justify-center shrink-0 mt-0.5">
              <span className="material-symbols-outlined text-[15px]">info</span>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-primary">Hello! How can I assist you today?</p>
              <p className="text-on-surface-variant text-[11px] leading-relaxed">
                Choose any question below. Answers are generated using verified hospital telemetry, clinical triage rules, and the dynamic ETA engine.
              </p>
            </div>
          </div>

          {/* Conversation History */}
          {conversation.map((entry, idx) => (
            <div key={idx} className="space-y-2.5">
              {/* Patient Question Bubble */}
              <div className="flex justify-end">
                <div className="bg-secondary text-white rounded-2xl rounded-tr-xs px-3.5 py-2.5 max-w-[85%] shadow-xs">
                  <p className="font-medium text-xs leading-relaxed">{entry.question.text}</p>
                </div>
              </div>

              {/* Assistant Answer Bubble */}
              <div className="flex justify-start">
                <div className="bg-surface-container-low border border-outline-variant/60 rounded-2xl rounded-tl-xs p-3.5 max-w-[92%] space-y-2 shadow-xs">
                  <div className="flex items-center justify-between gap-2 border-b border-outline-variant/30 pb-1.5">
                    <div className="flex items-center gap-1.5 text-secondary font-bold text-[11px]">
                      <span className="material-symbols-outlined text-[14px]">smart_toy</span>
                      <span>SmartQueue Assistant</span>
                    </div>
                    <span className="text-[9px] text-on-surface-variant font-mono px-1.5 py-0.5 rounded bg-surface-container">
                      {entry.response.source === 'gemini' ? '✨ Gemini AI Synthesized' : 'Clinical Telemetry'}
                    </span>
                  </div>

                  <p className="text-primary text-xs leading-relaxed font-normal whitespace-pre-wrap">
                    {entry.response.answer}
                  </p>

                  {/* Verified Data Telemetry Cards */}
                  {entry.response.verifiedData && (
                    <div className="mt-2 pt-2 border-t border-outline-variant/40 grid grid-cols-2 gap-1.5 text-[10px]">
                      {typeof entry.response.verifiedData.position === 'number' &&
                        entry.response.verifiedData.position > 0 && (
                          <div className="bg-white/80 border border-outline-variant/40 rounded-md p-1.5 flex items-center justify-between">
                            <span className="text-on-surface-variant">Queue Position:</span>
                            <span className="font-bold text-primary font-mono">
                              #{entry.response.verifiedData.position}
                            </span>
                          </div>
                        )}

                      {typeof entry.response.verifiedData.totalAhead === 'number' && (
                        <div className="bg-white/80 border border-outline-variant/40 rounded-md p-1.5 flex items-center justify-between">
                          <span className="text-on-surface-variant">Patients Ahead:</span>
                          <span className="font-bold text-primary font-mono">
                            {entry.response.verifiedData.totalAhead}
                          </span>
                        </div>
                      )}

                      {entry.response.verifiedData.estimatedWaitMinutes !== null &&
                        typeof entry.response.verifiedData.estimatedWaitMinutes === 'number' && (
                          <div className="bg-white/80 border border-outline-variant/40 rounded-md p-1.5 flex items-center justify-between">
                            <span className="text-on-surface-variant">Dynamic ETA:</span>
                            <span className="font-bold text-secondary font-mono">
                              ~{entry.response.verifiedData.estimatedWaitMinutes}m
                            </span>
                          </div>
                        )}

                      {entry.response.verifiedData.room && (
                        <div className="bg-white/80 border border-outline-variant/40 rounded-md p-1.5 flex items-center justify-between">
                          <span className="text-on-surface-variant">Room:</span>
                          <span className="font-bold text-primary font-mono truncate max-w-[100px]">
                            {entry.response.verifiedData.room}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Provenance Badge */}
                  <div className="pt-1 flex items-center justify-between text-[9px] text-on-surface-variant">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px] text-emerald-600">verified</span>
                      <span>Verified against live OPD queue state</span>
                    </span>
                    <span className="font-mono">
                      {new Date(entry.response.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Loading Indicator */}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-surface-container-low border border-outline-variant rounded-2xl rounded-tl-xs p-3 space-y-1.5 shadow-xs">
                <div className="flex items-center gap-2 text-on-surface-variant text-xs">
                  <span className="w-2 h-2 rounded-full bg-secondary animate-bounce"></span>
                  <span className="w-2 h-2 rounded-full bg-secondary animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-2 h-2 rounded-full bg-secondary animate-bounce [animation-delay:0.4s]"></span>
                  <span className="text-[11px] text-secondary font-medium ml-1">
                    Consulting live hospital telemetry & clinical triage engine...
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 text-red-900 rounded-lg text-xs flex items-start gap-2">
              <span className="material-symbols-outlined text-[16px] text-red-600 mt-0.5">error</span>
              <p>{error}</p>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Predefined Selectable Questions Section (Strictly No Free-Text Input) */}
        <footer className="p-3 bg-surface-container-low border-t border-outline-variant space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-secondary">help</span>
              Select a Clinical FAQ Topic:
            </span>
            <span className="text-[10px] text-on-surface-variant font-mono">
              {filteredQuestions.length} Approved Topics
            </span>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
            {CATEGORIES.map((cat) => {
              const active = selectedCategory === cat.id;
              const count = categoryCounts[cat.id] ?? 0;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-full font-medium transition-all shrink-0 flex items-center gap-1 text-[10px] cursor-pointer ${
                    active
                      ? 'bg-secondary text-white shadow-xs font-semibold'
                      : 'bg-white hover:bg-surface-container text-on-surface-variant border border-outline-variant/60'
                  }`}
                >
                  <span className="material-symbols-outlined text-[12px]">{cat.icon}</span>
                  <span>{cat.label}</span>
                  <span
                    className={`text-[9px] px-1 rounded-full font-mono ${
                      active ? 'bg-white/20' : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Questions Grid */}
          <div
            className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-0.5"
            role="group"
            aria-label="Selectable FAQ questions"
          >
            {filteredQuestions.map((q) => {
              const isSelected = selectedQuestion?.id === q.id;
              return (
                <button
                  key={q.id}
                  onClick={() => handleSelectQuestion(q)}
                  disabled={loading}
                  aria-label={q.text}
                  className={`text-left text-[11px] p-2 rounded-lg border transition-all flex items-start gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    isSelected
                      ? 'bg-secondary/10 border-secondary text-secondary font-semibold'
                      : 'bg-white hover:bg-surface-container border-outline-variant/60 text-primary hover:border-secondary/40 shadow-2xs'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px] text-secondary shrink-0 mt-0.5">
                    help_outline
                  </span>
                  <span className="leading-tight line-clamp-2">{q.text}</span>
                </button>
              );
            })}
          </div>

          <p className="text-[10px] text-center text-on-surface-variant/80 pt-0.5">
            🔒 Selectable FAQ mode enabled. Free-text input is restricted to ensure clinically verified responses.
          </p>
        </footer>
      </div>
    </div>
  );
};
