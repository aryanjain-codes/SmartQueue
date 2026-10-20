export type OPDDepartment = 'General Medicine' | 'Cardiology' | 'Orthopaedics';

export type TriageSeverity = 'Routine' | 'Urgent Priority' | 'Senior Priority' | 'Pediatric Fast-Track';

export type QueueStatus = 'WAITING' | 'SERVING' | 'COMPLETED' | 'HOLD_LAB';

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
}

export interface PatientQueueView extends PatientRecord {
  position: number; // 1-based index among waiting patients in their OPD
  totalAhead: number;
  nowServingToken: string | null;
  estimatedWaitMinutes: number;
}

export interface DepartmentSummary {
  department: OPDDepartment;
  displayName: string;
  room: string;
  suite: string;
  doctor: string;
  active: boolean;
  activeDesks: number;
  nowServingToken: string | null;
  nowServingPatient: PatientRecord | null;
  waitingCount: number;
  totalServedToday: number;
  averageWaitMinutes: number;
  currentConsultationSeconds?: number;
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
