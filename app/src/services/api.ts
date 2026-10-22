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

const BASE_URL = '/api';

export const DEFAULT_SECURITY_TOKEN = 'sec-gate-token-402';
export const DEFAULT_CLINICAL_TOKEN = 'cln-med-token-104';

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
export async function fetchClinicalQueueState(token = DEFAULT_CLINICAL_TOKEN): Promise<SmartQueueState> {
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
export async function fetchPatientChart(query: string, token = DEFAULT_CLINICAL_TOKEN): Promise<PatientRecord> {
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
  token = DEFAULT_CLINICAL_TOKEN
): Promise<{
  success: boolean;
  department: OPDDepartment;
  previous: PatientRecord | null;
  current: PatientRecord | null;
  state: SmartQueueState;
}> {
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
  token = DEFAULT_CLINICAL_TOKEN
): Promise<{
  success: boolean;
  department: OPDDepartment;
  completed: PatientRecord | null;
  state: SmartQueueState;
}> {
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
  staffToken = DEFAULT_CLINICAL_TOKEN
): Promise<{
  success: boolean;
  patient: PatientRecord;
  state: SmartQueueState;
}> {
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
  staffToken = DEFAULT_CLINICAL_TOKEN
): Promise<{
  success: boolean;
  patient: PatientRecord;
  state: SmartQueueState;
}> {
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
  token = DEFAULT_SECURITY_TOKEN,
  gateId = 'Gate 02'
): Promise<GateClearanceDTO> {
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
 * Gate Scan Audit Logs (Security or Clinical staff credentials)
 */
export async function fetchScanLogs(token = DEFAULT_SECURITY_TOKEN): Promise<GateScanLogEntry[]> {
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
