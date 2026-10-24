export type OPDDepartment = 'General Medicine' | 'Cardiology' | 'Orthopaedics';

export type TriageSeverity = 'Routine' | 'Urgent Priority' | 'Senior Priority' | 'Pediatric Fast-Track';

export type QueueStatus = 'WAITING' | 'SERVING' | 'COMPLETED' | 'HOLD_LAB' | 'CANCELLED' | 'ABSENT';

export interface PatientRecord {
  id: string; // e.g. "SJH-2025-8841"
  token: string; // e.g. "MED-042"
  passId: string; // e.g. "SQ-PASS-90412-B"
  passExpiry: string; // ISO date
  passStatus?: 'active' | 'expired' | 'revoked';
  fullName: string;
  age: number;
  gender: string;
  contactNumber: string;
  mrn?: string;
  department: OPDDepartment;
  room: string;
  doctor: string;
  chiefComplaint: string;
  allergies: string[];
  status: QueueStatus;
  triageSeverity: TriageSeverity;
  location: string;
  registeredAt: string; // ISO
  calledAt?: string; // ISO
  completedAt?: string; // ISO
  notes?: string;
  estimatedWaitMinutes?: number | null;
  totalAhead?: number;
  position?: number;
  etaUnavailable?: boolean;
  etaReason?: string;
}

export interface PatientQueueView extends PatientRecord {
  position: number; // 1-based index among waiting patients in their OPD
  totalAhead: number;
  nowServingToken: string | null;
  estimatedWaitMinutes: number | null;
  etaUnavailable?: boolean;
  etaReason?: string;
  lastUpdated?: string;
}

export interface DepartmentSummary {
  department: OPDDepartment;
  displayName: string;
  room: string;
  suite: string;
  doctor: string;
  active: boolean;
  doctorAvailable?: boolean;
  activeDesks: number;
  nowServingToken: string | null;
  nowServingPatient: PatientRecord | null;
  waitingCount: number;
  totalServedToday: number;
  averageWaitMinutes: number;
  currentConsultationSeconds?: number;
  isHistoricalAvg?: boolean;
  delayReason?: string | null;
}

export interface SmartQueueState {
  patients: PatientRecord[];
  departments: Record<OPDDepartment, DepartmentSummary>;
  lastUpdated: string;
  systemMetrics: {
    totalCheckedIn: number;
    totalServed: number;
    inWaiting: number;
    atLab: number;
    velocitySlaPercent: number;
    averageWaitMinutes: number;
  };
}

export interface RegistrationPayload {
  fullName: string;
  age: number;
  gender: string;
  contactNumber: string;
  mrn?: string;
  department: OPDDepartment;
  chiefComplaint: string;
  allergies: string[];
}

// ==========================================
// DTOs for Security & Data Privacy
// ==========================================

export type StaffRole = 'clinical' | 'security' | 'public';

export interface StaffUser {
  id: string;
  name: string;
  role: StaffRole;
  designation: string;
}

/**
 * Public queue record - excludes contactNumber, MRN, chiefComplaint, allergies, clinical notes
 */
export interface PublicQueuePatientDTO {
  id: string; // obfuscated / public reference (e.g. "PT-**348")
  token: string; // e.g. "MED-042"
  department: OPDDepartment;
  room: string;
  status: QueueStatus;
  triageSeverity: TriageSeverity;
  location: string;
  registeredAt: string;
  position?: number;
  totalAhead?: number;
  estimatedWaitMinutes?: number | null;
  etaUnavailable?: boolean;
}

/**
 * Public queue state returned to unauthenticated clients
 */
export interface PublicQueueStateDTO {
  patients: PublicQueuePatientDTO[];
  departments: Record<OPDDepartment, DepartmentSummary>;
  lastUpdated: string;
  systemMetrics: {
    totalCheckedIn: number;
    totalServed: number;
    inWaiting: number;
    atLab: number;
    velocitySlaPercent: number;
    averageWaitMinutes: number;
  };
}

export type AnyQueueState = SmartQueueState | PublicQueueStateDTO;

/**
 * Gate clearance response returned to Security Kiosk - contains only operational minimums
 * Strictly excludes: contactNumber, MRN, chiefComplaint, allergies, clinical notes
 */
export interface GateClearanceDTO {
  outcome: 'VALID' | 'EXPIRED' | 'REVOKED' | 'INVALID';
  message: string;
  passId?: string;
  token?: string;
  patientNameMasked?: string; // e.g. "Eleanor V."
  department?: string;
  room?: string;
  passExpiry?: string;
  clearanceLevel?: string;
  scanTimestamp: string;
  isDuplicateScan?: boolean;
  duplicateWarning?: string;
}

/**
 * Persistent gate entry scan log entry
 */
export interface GateScanLogEntry {
  id: string;
  passIdOrCode: string;
  outcome: 'VALID' | 'EXPIRED' | 'REVOKED' | 'INVALID';
  timestamp: string;
  operatorId: string;
  gateId: string;
  patientNameMasked?: string;
  token?: string;
  isDuplicate: boolean;
}

