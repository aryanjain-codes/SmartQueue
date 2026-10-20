import {
  SmartQueueState,
  PatientQueueView,
  RegistrationPayload,
  OPDDepartment,
  PatientRecord,
} from '../types/queue';

const BASE_URL = '/api';

export async function fetchQueueState(): Promise<SmartQueueState> {
  const res = await fetch(`${BASE_URL}/queue`);
  if (!res.ok) {
    throw new Error(`Failed to fetch queue state: ${res.statusText}`);
  }
  return res.json();
}

export async function lookupTokenOrPatient(query: string): Promise<PatientQueueView> {
  const res = await fetch(`${BASE_URL}/token/${encodeURIComponent(query.trim())}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Patient or Token "${query}" not found`);
  }
  return res.json();
}

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

export async function staffCallNext(department: OPDDepartment): Promise<{
  success: boolean;
  department: OPDDepartment;
  previous: PatientRecord | null;
  current: PatientRecord | null;
  state: SmartQueueState;
}> {
  const res = await fetch(`${BASE_URL}/staff/call-next`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ department }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to call next patient');
  }
  return res.json();
}

export async function staffCompleteConsultation(department: OPDDepartment): Promise<{
  success: boolean;
  department: OPDDepartment;
  completed: PatientRecord | null;
  state: SmartQueueState;
}> {
  const res = await fetch(`${BASE_URL}/staff/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ department }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to complete consultation');
  }
  return res.json();
}

export async function staffHoldLab(token: string): Promise<{
  success: boolean;
  patient: PatientRecord;
  state: SmartQueueState;
}> {
  const res = await fetch(`${BASE_URL}/staff/hold-lab`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to hold for lab');
  }
  return res.json();
}

export async function staffCallToken(token: string): Promise<{
  success: boolean;
  patient: PatientRecord;
  state: SmartQueueState;
}> {
  const res = await fetch(`${BASE_URL}/staff/call-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to call token');
  }
  return res.json();
}

export async function verifyPass(code: string): Promise<{
  outcome: 'VALID' | 'EXPIRED' | 'REVOKED' | 'INVALID';
  patient?: PatientRecord;
  message: string;
  clearanceLevel?: string;
}> {
  const res = await fetch(`${BASE_URL}/scanner/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    throw new Error('Verification network request failed');
  }
  return res.json();
}

export async function resetDemoData(): Promise<SmartQueueState> {
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
