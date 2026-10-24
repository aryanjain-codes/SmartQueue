export interface AssistantQuestion {
  id: string;
  text: string;
  category: 'queue' | 'priority' | 'status' | 'general';
  isPatientSpecific: boolean;
}

export interface VerifiedQueueData {
  token?: string;
  patientNameMasked?: string;
  department?: string;
  room?: string;
  doctor?: string;
  status?: string;
  position?: number;
  totalAhead?: number;
  estimatedWaitMinutes?: number | null;
  etaUnavailable?: boolean;
  etaReason?: string;
  delayReason?: string | null;
  doctorAvailable?: boolean;
  activeDesks?: number;
}

export interface AssistantFaqRequest {
  questionId: string;
  token?: string;
  passId?: string;
}

export interface AssistantFaqResponse {
  success: boolean;
  questionId: string;
  questionText: string;
  answer: string;
  verifiedData?: VerifiedQueueData;
  source: 'gemini' | 'predefined_fallback';
  timestamp: string;
  error?: string;
}
