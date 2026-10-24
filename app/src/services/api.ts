import {
  SmartQueueState,
  PublicQueueStateDTO,
  PatientQueueView,
  RegistrationPayload,
  OPDDepartment,
  PatientRecord,
  GateClearanceDTO,
  GateScanLogEntry,
} from '../types/queue';
import {
  AssistantQuestion,
  AssistantFaqRequest,
  AssistantFaqResponse,
} from '../types/assistant';

// Dynamically resolve API URL:
// 1. If VITE_API_URL is configured, use it.
// 2. If running on Netlify, route to deployed Render backend.
// 3. Otherwise (running locally or on Render same-origin), use relative /api.
const BASE_URL =
  (typeof process !== 'undefined' && process.env?.VITE_API_URL) ||
  (import.meta as any).env?.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.origin.includes('netlify.app')
    ? 'https://smartqueue-rrys.onrender.com/api'
    : '/api');

export const DEFAULT_SECURITY_TOKEN = 'sec-gate-token-402';
export const DEFAULT_CLINICAL_TOKEN = 'cln-med-token-104';

export interface StaffSessionUser {
  username: string;
  role: 'clinical' | 'security';
  name: string;
  operatorId: string;
}

export interface StaffSession {
  token: string;
  user: StaffSessionUser;
  expiresAt: string;
}

const SESSION_STORAGE_KEY = 'smartqueue_staff_session';

/**
 * Retrieve active staff session from sessionStorage with expiration check.
 */
export function getStoredStaffSession(): StaffSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as StaffSession;
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

/**
 * Save active staff session to sessionStorage.
 */
export function setStoredStaffSession(session: StaffSession | null): void {
  if (typeof window === 'undefined') return;
  if (!session) {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } else {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }
}

/**
 * Clear stored staff session from sessionStorage.
 */
export function clearStoredStaffSession(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

/**
 * Retrieve the active staff bearer token from the stored session.
 */
export function getActiveStaffToken(requiredRole?: 'clinical' | 'security'): string {
  const session = getStoredStaffSession();
  if (!session) return '';
  if (requiredRole && session.user.role !== requiredRole) {
    return '';
  }
  return session.token || '';
}

/**
 * Staff Login API: Authenticate with username and password against backend
 */
export async function staffLogin(credentials: {
  username: string;
  password: string;
}): Promise<StaffSession> {
  const res = await fetch(`${BASE_URL}/staff/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || 'Login failed. Please check your credentials.');
  }

  const data = await res.json();
  const session: StaffSession = {
    token: data.token,
    user: data.user,
    expiresAt: data.expiresAt,
  };
  setStoredStaffSession(session);
  return session;
}

/**
 * Staff Session Verification API
 */
export async function staffVerifySession(tokenOverride?: string): Promise<{
  authenticated: boolean;
  user?: StaffSessionUser;
}> {
  const token = tokenOverride || getActiveStaffToken();
  if (!token) return { authenticated: false };

  const res = await fetch(`${BASE_URL}/staff/session`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    clearStoredStaffSession();
    return { authenticated: false };
  }

  return res.json();
}

/**
 * Staff Logout API
 */
export async function staffLogout(): Promise<void> {
  const token = getActiveStaffToken();
  clearStoredStaffSession();

  if (token) {
    try {
      await fetch(`${BASE_URL}/staff/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // ignore network errors on logout
    }
  }
}

/**
 * Fetch Public Queue State (unauthenticated, strictly sanitized DTO)
 */
export async function fetchQueueState(): Promise<PublicQueueStateDTO> {
  const res = await fetch(`${BASE_URL}/queue`);
  if (!res.ok) {
    throw new Error(`Failed to fetch queue state: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Fetch Protected Clinical Queue State (requires Clinical staff credentials)
 */
export async function fetchClinicalQueueState(tokenOverride?: string): Promise<SmartQueueState> {
  const token = tokenOverride || getActiveStaffToken('clinical') || DEFAULT_CLINICAL_TOKEN;
  const res = await fetch(`${BASE_URL}/staff/queue`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || 'Failed to fetch clinical queue state');
  }
  return res.json();
}

/**
 * Patient self-lookup by their own token, MRN, patient ID, or pass ID
 */
export async function lookupTokenOrPatient(query: string): Promise<PatientQueueView> {
  const res = await fetch(`${BASE_URL}/token/${encodeURIComponent(query.trim())}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Patient or Token "${query}" not found`);
  }
  return res.json();
}

/**
 * Retrieve Authorized Patient Chart (requires Clinical staff credentials)
 */
export async function fetchPatientChart(query: string, tokenOverride?: string): Promise<PatientRecord> {
  const token = tokenOverride || getActiveStaffToken('clinical') || DEFAULT_CLINICAL_TOKEN;
  const res = await fetch(`${BASE_URL}/staff/patient/${encodeURIComponent(query.trim())}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || 'Failed to fetch patient chart');
  }
  return res.json();
}

/**
 * Persist Attending Consultation Notes to SQLite (requires Clinical staff credentials)
 */
export async function updatePatientNotes(
  query: string,
  notes: string,
  tokenOverride?: string
): Promise<{ success: boolean; patient: PatientRecord }> {
  const token = tokenOverride || getActiveStaffToken('clinical') || DEFAULT_CLINICAL_TOKEN;
  const res = await fetch(`${BASE_URL}/staff/patient/${encodeURIComponent(query.trim())}/notes`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || 'Failed to update consultation notes');
  }
  return res.json();
}

/**
 * Register new patient with synthetic demographic & triage details
 */
export async function registerPatient(payload: RegistrationPayload): Promise<PatientQueueView> {
  const res = await fetch(`${BASE_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Registration failed: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Staff Action: Call Next Patient (Clinical staff credentials)
 */
export async function staffCallNext(
  department: OPDDepartment,
  tokenOverride?: string
): Promise<{
  success: boolean;
  department: OPDDepartment;
  previous: PatientRecord | null;
  current: PatientRecord | null;
  state: SmartQueueState;
}> {
  const token = tokenOverride || getActiveStaffToken('clinical') || DEFAULT_CLINICAL_TOKEN;
  const res = await fetch(`${BASE_URL}/staff/call-next`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ department }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || 'Failed to call next patient');
  }
  return res.json();
}

/**
 * Staff Action: Complete Consultation (Clinical staff credentials)
 */
export async function staffCompleteConsultation(
  department: OPDDepartment,
  tokenOverride?: string
): Promise<{
  success: boolean;
  department: OPDDepartment;
  completed: PatientRecord | null;
  state: SmartQueueState;
}> {
  const token = tokenOverride || getActiveStaffToken('clinical') || DEFAULT_CLINICAL_TOKEN;
  const res = await fetch(`${BASE_URL}/staff/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ department }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || 'Failed to complete consultation');
  }
  return res.json();
}

/**
 * Staff Action: Send to Diagnostic Lab (Clinical staff credentials)
 */
export async function staffHoldLab(
  token: string,
  staffTokenOverride?: string
): Promise<{
  success: boolean;
  patient: PatientRecord;
  state: SmartQueueState;
}> {
  const staffToken = staffTokenOverride || getActiveStaffToken('clinical') || DEFAULT_CLINICAL_TOKEN;
  const res = await fetch(`${BASE_URL}/staff/hold-lab`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staffToken}`,
    },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || 'Failed to hold for lab');
  }
  return res.json();
}

/**
 * Staff Action: Call Specific Token (Clinical staff credentials)
 */
export async function staffCallToken(
  token: string,
  staffTokenOverride?: string
): Promise<{
  success: boolean;
  patient: PatientRecord;
  state: SmartQueueState;
}> {
  const staffToken = staffTokenOverride || getActiveStaffToken('clinical') || DEFAULT_CLINICAL_TOKEN;
  const res = await fetch(`${BASE_URL}/staff/call-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staffToken}`,
    },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || 'Failed to call token');
  }
  return res.json();
}

/**
 * Gate Scanner Verification (Security or Clinical staff credentials)
 * Returns GateClearanceDTO strictly containing operational metadata (NO clinical or personal data)
 */
export async function verifyPass(
  code: string,
  tokenOverride?: string,
  gateId = 'Gate 02'
): Promise<GateClearanceDTO> {
  const token = tokenOverride || getActiveStaffToken() || DEFAULT_SECURITY_TOKEN;
  const res = await fetch(`${BASE_URL}/scanner/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ code, gateId }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || 'Verification request failed');
  }
  return res.json();
}

/**
 * Update a patient's pass status (active/expired/revoked) on the server.
 * Requires Security or Clinical staff credentials.
 */
export async function updatePassStatus(
  code: string,
  status: 'active' | 'expired' | 'revoked',
  tokenOverride?: string
): Promise<{ success: boolean; patient: PatientQueueView | null }> {
  const token = tokenOverride || getActiveStaffToken() || DEFAULT_SECURITY_TOKEN;
  const res = await fetch(`${BASE_URL}/scanner/pass-status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ code, status }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || 'Failed to update pass status');
  }
  return res.json();
}

/**
 * Gate Scan Audit Logs (Security or Clinical staff credentials)
 */
export async function fetchScanLogs(tokenOverride?: string): Promise<GateScanLogEntry[]> {
  const token = tokenOverride || getActiveStaffToken() || DEFAULT_SECURITY_TOKEN;
  const res = await fetch(`${BASE_URL}/scanner/logs`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || 'Failed to fetch scan logs');
  }
  return res.json();
}

/**
 * Reset demo database to initial seed
 */
export async function resetDemoData(): Promise<PublicQueueStateDTO> {
  const res = await fetch(`${BASE_URL}/reset-demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new Error('Failed to reset demo state');
  }
  const data = await res.json();
  return data.state;
}

/**
 * Cancel or mark a patient absent from the queue (Staff credentials required)
 */
export async function staffCancelQueuePatient(
  token: string,
  reason?: string,
  tokenOverride?: string
): Promise<{ success: boolean; patient: PatientQueueView | null }> {
  const authToken = tokenOverride || getActiveStaffToken() || DEFAULT_CLINICAL_TOKEN;
  const res = await fetch(`${BASE_URL}/staff/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ token, reason }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || 'Failed to cancel queue ticket');
  }
  return res.json();
}

/**
 * Update doctor / desk availability for a department (Staff credentials required)
 */
export async function staffSetDoctorStatus(
  department: OPDDepartment,
  available: boolean,
  activeDesks?: number,
  tokenOverride?: string
): Promise<{ success: boolean; result: any }> {
  const authToken = tokenOverride || getActiveStaffToken() || DEFAULT_CLINICAL_TOKEN;
  const res = await fetch(`${BASE_URL}/staff/doctor-status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ department, available, activeDesks }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || 'Failed to update doctor availability');
  }
  return res.json();
}

/**
 * Reassign patient to another OPD department (Clinical staff credentials required)
 */
export async function staffReassignPatient(
  token: string,
  department: OPDDepartment,
  tokenOverride?: string
): Promise<{ success: boolean; patient: PatientQueueView | null }> {
  const authToken = tokenOverride || getActiveStaffToken('clinical') || DEFAULT_CLINICAL_TOKEN;
  const res = await fetch(`${BASE_URL}/staff/reassign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ token, department }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || 'Failed to reassign patient');
  }
  return res.json();
}

/**
 * Fetch allowlisted predefined FAQ questions for SmartQueue Assistant
 */
export async function fetchAssistantQuestions(): Promise<AssistantQuestion[]> {
  const res = await fetch(`${BASE_URL}/assistant/questions`);
  if (!res.ok) {
    throw new Error('Failed to load assistant questions');
  }
  const data = await res.json();
  return data.questions || [];
}

/**
 * Ask SmartQueue Assistant a predefined question with verified telemetry
 */
export async function askAssistantQuestion(
  payload: AssistantFaqRequest
): Promise<AssistantFaqResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (payload.passId) {
    headers['x-patient-pass-id'] = payload.passId;
  }

  const res = await fetch(`${BASE_URL}/assistant/faq`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Failed to get answer from assistant');
  }
  return data;
}

