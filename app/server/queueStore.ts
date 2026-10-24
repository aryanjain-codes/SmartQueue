import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  OPDDepartment,
  PatientRecord,
  PatientQueueView,
  DepartmentSummary,
  SmartQueueState,
  PublicQueueStateDTO,
  PublicQueuePatientDTO,
  RegistrationPayload,
  TriageSeverity,
  GateClearanceDTO,
  GateScanLogEntry,
  StaffRole,
} from '../src/types/queue';
import {
  getDb,
  getAllPatients,
  findPatientByQuery,
  isIdExists,
  isTokenExists,
  isPassTokenExists,
  insertPatientRecord,
  updateQueueEntry,
  updatePassStatusDb,
  updatePatientNotes as updatePatientNotesInDb,
  insertScanLog,
  getRecentScanLogsFromDb,
  migrateFromJsonIfEmpty,
  resetDatabase,
  backupDatabase,
  getCompletedConsultationDurations,
  DATA_DIR,
  DB_PATH,
} from './sqliteDb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(DATA_DIR, 'smartqueue.json');
const SCANS_FILE = path.join(DATA_DIR, 'gate_scans.json');

const DEPARTMENT_CONFIGS: Record<
  OPDDepartment,
  {
    room: string;
    suite: string;
    doctor: string;
    prefix: string;
    activeDesks: number;
    avgMinutes: number;
  }
> = {
  'General Medicine': {
    room: 'Room 104',
    suite: 'Clinic Suite B',
    doctor: 'Dr. Sarah Jenkins, MD',
    prefix: 'MED',
    activeDesks: 3,
    avgMinutes: 4.5,
  },
  Cardiology: {
    room: 'Room 102',
    suite: 'Clinic Suite A',
    doctor: 'Dr. Marcus Vance, MD',
    prefix: 'CARD',
    activeDesks: 2,
    avgMinutes: 6.0,
  },
  Orthopaedics: {
    room: 'Room 105',
    suite: 'Clinic Suite C',
    doctor: 'Dr. Keith Thorne, MD',
    prefix: 'ORTH',
    activeDesks: 1,
    avgMinutes: 5.0,
  },
};

/**
 * Priority-aware comparator for OPD queueing:
 * - Urgent Priority (emergency triage) is prioritized first (weight 100).
 * - Senior Priority & Pediatric Fast-Track are prioritized above Routine (weight 50).
 * - Routine is standard FIFO (weight 10).
 * - Between patients with identical triage severity, earlier registration timestamp wins.
 */
export function compareQueuePriority(a: PatientRecord, b: PatientRecord): number {
  const getWeight = (sev: TriageSeverity) => {
    if (sev === 'Urgent Priority') return 100;
    if (sev === 'Senior Priority') return 50;
    if (sev === 'Pediatric Fast-Track') return 50;
    return 10;
  };
  const wA = getWeight(a.triageSeverity);
  const wB = getWeight(b.triageSeverity);
  if (wA !== wB) return wB - wA; // higher priority first
  return new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime(); // earlier registration first
}

export function maskFullName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return fullName;
  const first = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${first} ${lastInitial}.`;
}

export function generateSecurePassId(): string {
  // 16 bytes = 32 hex characters of cryptographic entropy (128 bits)
  const token = crypto.randomBytes(16).toString('hex').toUpperCase();
  return `SQ-PASS-${token}-B`;
}

export function generateInitialSeed(): PatientRecord[] {
  const now = Date.now();
  const thirtyDaysAhead = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
  const pastExpiredDate = new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(); // 5 days ago

  return [
    // General Medicine (Serving + Waiting)
    {
      id: 'SJH-2025-8821',
      token: 'MED-039',
      passId: 'SQ-PASS-88210A1B2C3D4E5F6789-B',
      passExpiry: thirtyDaysAhead,
      passStatus: 'active',
      fullName: 'Arthur Pendelton',
      age: 58,
      gender: 'Male',
      contactNumber: '(555) 349-1102',
      mrn: 'PT-884210',
      department: 'General Medicine',
      room: 'Room 104',
      doctor: 'Dr. Sarah Jenkins, MD',
      chiefComplaint: 'Hypertension Review & Lipid Profile check',
      allergies: ['None reported'],
      status: 'SERVING',
      triageSeverity: 'Routine',
      location: 'Consultation Room 104',
      registeredAt: new Date(now - 45 * 60 * 1000).toISOString(),
      calledAt: new Date(now - 8 * 60 * 1000).toISOString(),
    },
    {
      id: 'SJH-2025-8832',
      token: 'MED-040',
      passId: 'SQ-PASS-88320C3D4E5F6A7B8C9D-B',
      passExpiry: thirtyDaysAhead,
      passStatus: 'active',
      fullName: 'David Ross',
      age: 42,
      gender: 'Male',
      contactNumber: '(555) 781-9902',
      mrn: 'PT-***902',
      department: 'General Medicine',
      room: 'Room 104',
      doctor: 'Dr. Sarah Jenkins, MD',
      chiefComplaint: 'Severe abdominal cramping and dehydration since morning',
      allergies: ['None reported'],
      status: 'WAITING',
      triageSeverity: 'Urgent Priority',
      location: 'Waiting Hall B',
      registeredAt: new Date(now - 29 * 60 * 1000).toISOString(),
    },
    {
      id: 'SJH-2025-8837',
      token: 'MED-041',
      passId: 'SQ-PASS-88370D4E5F6A7B8C9D0E-B',
      passExpiry: thirtyDaysAhead,
      passStatus: 'active',
      fullName: 'Fatima Al-Mansoor',
      age: 29,
      gender: 'Female',
      contactNumber: '(555) 674-4415',
      mrn: 'PT-***415',
      department: 'General Medicine',
      room: 'Room 104',
      doctor: 'Dr. Sarah Jenkins, MD',
      chiefComplaint: 'Sore throat, fever 38.2C, productive cough for 2 days',
      allergies: ['Sulfa Drugs'],
      status: 'WAITING',
      triageSeverity: 'Routine',
      location: 'At Vitals Check',
      registeredAt: new Date(now - 22 * 60 * 1000).toISOString(),
    },
    {
      id: 'SJH-2025-8841',
      token: 'MED-042',
      passId: 'SQ-PASS-90412E5F6A7B8C9D0E1F-B',
      passExpiry: thirtyDaysAhead,
      passStatus: 'active',
      fullName: 'Eleanor Vance',
      age: 34,
      gender: 'Female',
      contactNumber: '(555) 234-8910',
      mrn: 'SJH-98214-X',
      department: 'General Medicine',
      room: 'Room 104',
      doctor: 'Dr. Sarah Jenkins, MD',
      chiefComplaint: 'Mild recurrent migraine and photophobia for 3 days',
      allergies: ['Penicillin', 'Sulfa Drugs'],
      status: 'WAITING',
      triageSeverity: 'Routine',
      location: 'Waiting Hall B',
      registeredAt: new Date(now - 14 * 60 * 1000).toISOString(),
    },
    {
      id: 'SJH-2025-8846',
      token: 'MED-043',
      passId: 'SQ-PASS-90460F6A7B8C9D0E1F2A-B',
      passExpiry: thirtyDaysAhead,
      passStatus: 'active',
      fullName: 'Robert Chen',
      age: 67,
      gender: 'Male',
      contactNumber: '(555) 412-5532',
      mrn: 'PT-***532',
      department: 'General Medicine',
      room: 'Room 104',
      doctor: 'Dr. Sarah Jenkins, MD',
      chiefComplaint: 'Post-viral fatigue and mild dyspnea on exertion',
      allergies: ['None reported'],
      status: 'WAITING',
      triageSeverity: 'Senior Priority',
      location: 'Waiting Hall B',
      registeredAt: new Date(now - 6 * 60 * 1000).toISOString(),
    },
    {
      id: 'SJH-2025-8850',
      token: 'MED-044',
      passId: 'SQ-PASS-90500A7B8C9D0E1F2A3B-B',
      passExpiry: thirtyDaysAhead,
      passStatus: 'active',
      fullName: 'Clara Oswald',
      age: 8,
      gender: 'Female',
      contactNumber: '(555) 301-1119',
      mrn: 'PT-***119',
      department: 'General Medicine',
      room: 'Room 104',
      doctor: 'Dr. Sarah Jenkins, MD',
      chiefComplaint: 'Mild earache and runny nose',
      allergies: ['None reported'],
      status: 'WAITING',
      triageSeverity: 'Pediatric Fast-Track',
      location: 'Triage Intake',
      registeredAt: new Date(now - 2 * 60 * 1000).toISOString(),
    },

    // Cardiology
    {
      id: 'SJH-2025-7711',
      token: 'CARD-012',
      passId: 'SQ-PASS-77110B8C9D0E1F2A3B4C-B',
      passExpiry: thirtyDaysAhead,
      passStatus: 'active',
      fullName: 'Marcus Brody',
      age: 61,
      gender: 'Male',
      contactNumber: '(555) 888-2301',
      mrn: 'PT-77110',
      department: 'Cardiology',
      room: 'Room 102',
      doctor: 'Dr. Marcus Vance, MD',
      chiefComplaint: 'ECG follow-up and angina medication review',
      allergies: ['Aspirin'],
      status: 'SERVING',
      triageSeverity: 'Routine',
      location: 'Consultation Room 102',
      registeredAt: new Date(now - 35 * 60 * 1000).toISOString(),
      calledAt: new Date(now - 12 * 60 * 1000).toISOString(),
    },
    {
      id: 'SJH-2025-7719',
      token: 'CARD-013',
      passId: 'SQ-PASS-77190C9D0E1F2A3B4C5D-B',
      passExpiry: thirtyDaysAhead,
      passStatus: 'active',
      fullName: 'Elena Gomez',
      age: 48,
      gender: 'Female',
      contactNumber: '(555) 723-9041',
      mrn: 'PT-77190',
      department: 'Cardiology',
      room: 'Room 102',
      doctor: 'Dr. Marcus Vance, MD',
      chiefComplaint: 'Palpitations and irregular pulse noted during resting',
      allergies: ['None reported'],
      status: 'WAITING',
      triageSeverity: 'Urgent Priority',
      location: 'Waiting Hall A',
      registeredAt: new Date(now - 18 * 60 * 1000).toISOString(),
    },
    {
      id: 'SJH-2025-7724',
      token: 'CARD-014',
      passId: 'SQ-PASS-77240D0E1F2A3B4C5D6E-B',
      passExpiry: thirtyDaysAhead,
      passStatus: 'active',
      fullName: 'Harold Finch',
      age: 55,
      gender: 'Male',
      contactNumber: '(555) 349-8812',
      mrn: 'PT-77240',
      department: 'Cardiology',
      room: 'Room 102',
      doctor: 'Dr. Marcus Vance, MD',
      chiefComplaint: 'Routine 6-month pacemaker interrogation',
      allergies: ['None reported'],
      status: 'WAITING',
      triageSeverity: 'Routine',
      location: 'Waiting Hall A',
      registeredAt: new Date(now - 10 * 60 * 1000).toISOString(),
    },

    // Orthopaedics
    {
      id: 'SJH-2025-6610',
      token: 'ORTH-024',
      passId: 'SQ-PASS-66100E1F2A3B4C5D6E7F-B',
      passExpiry: thirtyDaysAhead,
      passStatus: 'active',
      fullName: 'Thomas Wayne',
      age: 45,
      gender: 'Male',
      contactNumber: '(555) 610-4491',
      mrn: 'PT-66100',
      department: 'Orthopaedics',
      room: 'Room 105',
      doctor: 'Dr. Keith Thorne, MD',
      chiefComplaint: 'Post-operative cast removal and range-of-motion assessment',
      allergies: ['None reported'],
      status: 'SERVING',
      triageSeverity: 'Routine',
      location: 'Consultation Room 105',
      registeredAt: new Date(now - 30 * 60 * 1000).toISOString(),
      calledAt: new Date(now - 6 * 60 * 1000).toISOString(),
    },
    {
      id: 'SJH-2025-6618',
      token: 'ORTH-025',
      passId: 'SQ-PASS-66180F2A3B4C5D6E7F8A-B',
      passExpiry: thirtyDaysAhead,
      passStatus: 'active',
      fullName: 'Samantha Reed',
      age: 32,
      gender: 'Female',
      contactNumber: '(555) 892-3100',
      mrn: 'PT-66180',
      department: 'Orthopaedics',
      room: 'Room 105',
      doctor: 'Dr. Keith Thorne, MD',
      chiefComplaint: 'Right ankle sprain sustained during sports; moderate swelling',
      allergies: ['NSAIDs'],
      status: 'WAITING',
      triageSeverity: 'Routine',
      location: 'Waiting Hall C',
      registeredAt: new Date(now - 15 * 60 * 1000).toISOString(),
    },
    {
      id: 'SJH-2025-6622',
      token: 'ORTH-026',
      passId: 'SQ-PASS-66220A3B4C5D6E7F8A9B-B',
      passExpiry: thirtyDaysAhead,
      passStatus: 'active',
      fullName: 'James Miller',
      age: 71,
      gender: 'Male',
      contactNumber: '(555) 777-1049',
      mrn: 'PT-66220',
      department: 'Orthopaedics',
      room: 'Room 105',
      doctor: 'Dr. Keith Thorne, MD',
      chiefComplaint: 'Chronic bilateral osteoarthritis knee pain, worse upon ambulation',
      allergies: ['None reported'],
      status: 'WAITING',
      triageSeverity: 'Senior Priority',
      location: 'Waiting Hall C',
      registeredAt: new Date(now - 8 * 60 * 1000).toISOString(),
    },

    // Explicit Test Fixture: Genuinely Expired Pass (Issued 35 days ago, expired 5 days ago)
    {
      id: 'SJH-2025-9988',
      token: 'MED-088',
      passId: 'SQ-PASS-EXPIRED-TEST-FIXTURE-B',
      passExpiry: pastExpiredDate,
      passStatus: 'expired',
      fullName: 'Walter White',
      age: 52,
      gender: 'Male',
      contactNumber: '(555) 391-4401',
      mrn: 'PT-99880',
      department: 'General Medicine',
      room: 'Room 104',
      doctor: 'Dr. Sarah Jenkins, MD',
      chiefComplaint: 'Routine pulmonary checkup and annual wellness evaluation',
      allergies: ['None reported'],
      status: 'COMPLETED',
      triageSeverity: 'Routine',
      location: 'Discharged / Lapsed Pass',
      registeredAt: new Date(now - 35 * 24 * 60 * 60 * 1000).toISOString(),
    },

    // Explicit Test Fixture: Genuinely Revoked Pass (Flagged by Infection Control)
    {
      id: 'SJH-2025-9999',
      token: 'MED-089',
      passId: 'SQ-PASS-REVOKED-TEST-FIXTURE-B',
      passExpiry: thirtyDaysAhead,
      passStatus: 'revoked',
      fullName: 'Jesse Pinkman',
      age: 26,
      gender: 'Male',
      contactNumber: '(555) 902-8819',
      mrn: 'PT-99990',
      department: 'General Medicine',
      room: 'Room 104',
      doctor: 'Dr. Sarah Jenkins, MD',
      chiefComplaint: 'External screening required per security protocol',
      allergies: ['None reported'],
      status: 'COMPLETED',
      triageSeverity: 'Urgent Priority',
      location: 'External Screening Tent 03',
      registeredAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

class QueueDatabase {
  private patients: PatientRecord[] = [];
  private scanLogs: GateScanLogEntry[] = [];
  private doctorAvailability: Record<OPDDepartment, boolean> = {
    'General Medicine': true,
    Cardiology: true,
    Orthopaedics: true,
  };
  private activeDesksOverride: Partial<Record<OPDDepartment, number>> = {};

  constructor() {
    // 1. Initialize SQLite schema and migrate from existing JSON if SQLite empty
    migrateFromJsonIfEmpty(generateInitialSeed);
    // 2. Synchronize active state from SQLite
    this.syncFromDb();
  }

  /**
   * Sync in-memory cache directly from SQLite and write a JSON backup snapshot.
   */
  private syncFromDb(): void {
    try {
      this.patients = getAllPatients();
      this.scanLogs = getRecentScanLogsFromDb(100);
      this.persistJsonSnapshot();
    } catch (err) {
      console.error('[QueueStore] Error syncing from SQLite database:', err);
    }
  }

  /**
   * Maintain backward-compatible JSON file snapshot for file-based tests and inspection.
   */
  private persistJsonSnapshot(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.patients, null, 2), 'utf-8');
      fs.writeFileSync(SCANS_FILE, JSON.stringify(this.scanLogs.slice(-100), null, 2), 'utf-8');
    } catch (err) {
      console.error('[QueueStore] Failed to write JSON backup snapshot:', err);
    }
  }

  public resetDemo(): PublicQueueStateDTO {
    resetDatabase(generateInitialSeed());
    this.doctorAvailability = {
      'General Medicine': true,
      Cardiology: true,
      Orthopaedics: true,
    };
    this.activeDesksOverride = {};
    this.syncFromDb();
    return this.getPublicState();
  }

  public backupDatabase(): string {
    return backupDatabase();
  }

  /**
   * Calculate dynamic average consultation duration using historical SQLite data.
   * If < 2 completed records are available, fall back to configured baseline duration.
   * Assumption: Configured fallback duration represents established hospital clinical baseline.
   */
  public getDepartmentConsultationDuration(dept: OPDDepartment): { avgMinutes: number; isHistorical: boolean } {
    const durations = getCompletedConsultationDurations(dept);
    if (durations.length >= 2) {
      const sum = durations.reduce((a, b) => a + b, 0);
      const avg = Math.round((sum / durations.length) * 10) / 10;
      return { avgMinutes: Math.max(1, avg), isHistorical: true };
    }
    return { avgMinutes: DEPARTMENT_CONFIGS[dept].avgMinutes, isHistorical: false };
  }

  /**
   * Toggle attending physician or counter availability for a department.
   */
  public setDoctorAvailability(
    department: OPDDepartment,
    available: boolean,
    activeDesks?: number,
    role?: StaffRole
  ): { success: boolean; department: OPDDepartment; available: boolean; activeDesks: number } {
    if (role && role !== 'clinical' && role !== 'security') {
      throw new Error('Access denied: Staff authorization required to change doctor availability.');
    }
    this.doctorAvailability[department] = available;
    if (typeof activeDesks === 'number' && activeDesks >= 0) {
      this.activeDesksOverride[department] = activeDesks;
    }
    return {
      success: true,
      department,
      available,
      activeDesks: this.activeDesksOverride[department] ?? DEPARTMENT_CONFIGS[department].activeDesks,
    };
  }

  /**
   * Mark a waiting patient as cancelled or absent.
   * Excludes them immediately from queue sequence and triggers live ETA recalculation.
   */
  public cancelPatientQueue(
    tokenOrId: string,
    reason = 'Patient Cancelled / Absent',
    role?: StaffRole
  ): { success: boolean; patient: PatientQueueView | null } {
    if (role && role !== 'clinical' && role !== 'security') {
      throw new Error('Access denied: Staff authorization required to cancel queue ticket.');
    }

    const query = tokenOrId.trim().toUpperCase();
    const patient = findPatientByQuery(query) || this.patients.find(
      (p) => p.token.toUpperCase() === query || p.passId.toUpperCase() === query || p.id.toUpperCase() === query
    );

    if (!patient) return { success: false, patient: null };

    const updated = updateQueueEntry(patient.token, {
      status: 'CANCELLED',
      location: reason,
    });

    if (updated) {
      this.syncFromDb();
      return { success: true, patient: this.getPatientSelfView(patient.token) };
    }
    return { success: false, patient: null };
  }

  /**
   * Authorized queue reassignment to another OPD department.
   */
  public reassignDepartment(
    tokenOrId: string,
    targetDept: OPDDepartment,
    role?: StaffRole
  ): { success: boolean; patient: PatientQueueView | null } {
    if (role !== 'clinical') {
      throw new Error('Access denied: Clinical staff authorization required for queue reassignment.');
    }

    const query = tokenOrId.trim().toUpperCase();
    const patient = findPatientByQuery(query) || this.patients.find(
      (p) => p.token.toUpperCase() === query || p.passId.toUpperCase() === query || p.id.toUpperCase() === query
    );

    if (!patient) return { success: false, patient: null };
    if (!DEPARTMENT_CONFIGS[targetDept]) {
      throw new Error(`Invalid target department: ${targetDept}`);
    }

    const targetConfig = DEPARTMENT_CONFIGS[targetDept];
    const updated = updateQueueEntry(patient.token, {
      department: targetDept,
      room: targetConfig.room,
      doctor: targetConfig.doctor,
      location: `Waiting Hall ${targetDept === 'Cardiology' ? 'A' : targetDept === 'Orthopaedics' ? 'C' : 'B'}`,
    });

    if (updated) {
      this.syncFromDb();
      return { success: true, patient: this.getPatientSelfView(patient.token) };
    }
    return { success: false, patient: null };
  }

  /**
   * Deterministic, priority-aware dynamic ETA calculator for a department.
   */
  public calculateDepartmentETAs(department: OPDDepartment): Map<string, {
    position: number;
    totalAhead: number;
    estimatedWaitMinutes: number | null;
    etaUnavailable: boolean;
    etaReason?: string;
  }> {
    const config = DEPARTMENT_CONFIGS[department];
    const isDocAvailable = this.doctorAvailability[department] ?? true;
    const activeDesks = this.activeDesksOverride[department] ?? config.activeDesks;
    const { avgMinutes } = this.getDepartmentConsultationDuration(department);

    const deptPatients = this.patients.filter((p) => p.department === department);
    const serving = deptPatients.find((p) => p.status === 'SERVING') || null;

    // Filter only eligible waiting patients (not completed, not cancelled, not expired, not revoked)
    const eligibleWaiting = deptPatients
      .filter((p) => p.status === 'WAITING' && p.passStatus !== 'expired' && p.passStatus !== 'revoked')
      .sort(compareQueuePriority);

    const resultMap = new Map<string, {
      position: number;
      totalAhead: number;
      estimatedWaitMinutes: number | null;
      etaUnavailable: boolean;
      etaReason?: string;
    }>();

    // Elapsed & remaining time of current consultation (avoids double counting)
    let remainingServingMinutes = 0;
    if (serving && serving.calledAt) {
      const elapsedMinutes = (Date.now() - new Date(serving.calledAt).getTime()) / (60 * 1000);
      remainingServingMinutes = Math.max(0.5, avgMinutes - elapsedMinutes);
    }

    const effectiveDesks = Math.max(1, activeDesks);

    eligibleWaiting.forEach((patient, index) => {
      const totalAhead = index;
      const position = index + 1;

      if (!isDocAvailable || activeDesks <= 0) {
        resultMap.set(patient.id, {
          position,
          totalAhead,
          estimatedWaitMinutes: null,
          etaUnavailable: true,
          etaReason: 'Attending Physician Unavailable / Desk Inactive',
        });
        return;
      }

      let estWait: number;
      if (totalAhead === 0) {
        // First in line: wait time depends on current serving desk completion or minimal triage prep buffer (2 mins)
        estWait = serving
          ? Math.max(2, Math.ceil(remainingServingMinutes / effectiveDesks))
          : Math.max(2, Math.round(avgMinutes / (effectiveDesks * 2)));
      } else {
        // Subsequent patients: remaining time of serving desk + durations of patients ahead
        const workAheadMinutes = remainingServingMinutes + (totalAhead * avgMinutes);
        estWait = Math.max(2, Math.ceil(workAheadMinutes / effectiveDesks));
      }

      resultMap.set(patient.id, {
        position,
        totalAhead,
        estimatedWaitMinutes: Math.max(0, estWait),
        etaUnavailable: false,
      });
    });

    return resultMap;
  }

  /**
   * Public queue state: Sanitized to remove all clinical notes, complaints, allergies, and contact numbers.
   */
  public getPublicState(): PublicQueueStateDTO {
    const deptKeys: OPDDepartment[] = ['General Medicine', 'Cardiology', 'Orthopaedics'];
    const departments = {} as Record<OPDDepartment, DepartmentSummary>;

    let totalWaiting = 0;
    let totalServed = 0;
    let totalLab = 0;
    let totalWaitTimeAccum = 0;
    let waitTimeCount = 0;

    const allEtas = new Map<string, {
      position: number;
      totalAhead: number;
      estimatedWaitMinutes: number | null;
      etaUnavailable: boolean;
      etaReason?: string;
    }>();

    for (const dept of deptKeys) {
      const config = DEPARTMENT_CONFIGS[dept];
      const deptPatients = this.patients.filter((p) => p.department === dept);
      const serving = deptPatients.find((p) => p.status === 'SERVING') || null;
      const waiting = deptPatients.filter((p) => p.status === 'WAITING' && p.passStatus !== 'expired' && p.passStatus !== 'revoked');
      const served = deptPatients.filter((p) => p.status === 'COMPLETED');
      const lab = deptPatients.filter((p) => p.status === 'HOLD_LAB');

      totalWaiting += waiting.length;
      totalServed += served.length;
      totalLab += lab.length;

      const deptEtas = this.calculateDepartmentETAs(dept);
      deptEtas.forEach((v, k) => allEtas.set(k, v));

      const { avgMinutes, isHistorical } = this.getDepartmentConsultationDuration(dept);
      const isDocAvailable = this.doctorAvailability[dept] ?? true;
      const activeDesks = this.activeDesksOverride[dept] ?? config.activeDesks;

      let deptWaitMins = 0;
      if (!isDocAvailable || activeDesks <= 0) {
        deptWaitMins = 0;
      } else if (waiting.length > 0) {
        const lastPatientEta = deptEtas.get(waiting[waiting.length - 1].id);
        deptWaitMins = lastPatientEta && lastPatientEta.estimatedWaitMinutes !== null
          ? lastPatientEta.estimatedWaitMinutes
          : Math.max(1, Math.ceil((waiting.length * avgMinutes) / Math.max(1, activeDesks)));
      }

      totalWaitTimeAccum += deptWaitMins;
      waitTimeCount++;

      let currentConsultationSeconds = 0;
      if (serving && serving.calledAt) {
        currentConsultationSeconds = Math.max(0, Math.floor((Date.now() - new Date(serving.calledAt).getTime()) / 1000));
      }

      // Sanitized serving patient representation for public state
      const publicServing = serving
        ? ({
            ...serving,
            fullName: maskFullName(serving.fullName),
            contactNumber: undefined,
            mrn: undefined,
            chiefComplaint: undefined,
            allergies: undefined,
            notes: undefined,
          } as unknown as PatientRecord)
        : null;

      departments[dept] = {
        department: dept,
        displayName: `${dept} (${config.room})`,
        room: config.room,
        suite: config.suite,
        doctor: config.doctor,
        active: isDocAvailable && activeDesks > 0,
        doctorAvailable: isDocAvailable,
        activeDesks,
        nowServingToken: serving ? serving.token : null,
        nowServingPatient: publicServing,
        waitingCount: waiting.length,
        totalServedToday: 18 + served.length,
        averageWaitMinutes: deptWaitMins,
        currentConsultationSeconds,
        isHistoricalAvg: isHistorical,
      };
    }

    const avgWait = waitTimeCount > 0 ? Math.round(totalWaitTimeAccum / waitTimeCount) : 10;

    // Public sanitized patient list (no medical details, no contact info)
    const sanitizedPatients: PublicQueuePatientDTO[] = this.patients.map((p) => {
      const etaInfo = allEtas.get(p.id);
      return {
        id: `PT-**${p.token.replace(/\D/g, '').slice(-3) || '000'}`,
        token: p.token,
        department: p.department,
        room: p.room,
        status: p.status,
        triageSeverity: p.triageSeverity,
        location: p.location,
        registeredAt: p.registeredAt,
        position: p.status === 'WAITING' ? (etaInfo ? etaInfo.position : undefined) : undefined,
        totalAhead: p.status === 'WAITING' ? (etaInfo ? etaInfo.totalAhead : undefined) : undefined,
        estimatedWaitMinutes: p.status === 'WAITING' ? (etaInfo ? etaInfo.estimatedWaitMinutes : null) : (p.status === 'SERVING' || p.status === 'COMPLETED' ? 0 : null),
        etaUnavailable: etaInfo ? etaInfo.etaUnavailable : undefined,
      };
    });

    return {
      patients: sanitizedPatients,
      departments,
      lastUpdated: new Date().toISOString(),
      systemMetrics: {
        totalCheckedIn: 342 + this.patients.length - 14,
        totalServed: 18 + totalServed,
        inWaiting: totalWaiting,
        atLab: 2 + totalLab,
        velocitySlaPercent: 94,
        averageWaitMinutes: avgWait,
      },
    };
  }

  /**
   * Protected Clinical Queue State: Returned only to authorized clinical staff
   */
  public getClinicalState(role?: StaffRole): SmartQueueState {
    if (role !== 'clinical') {
      throw new Error('Access denied: Clinical staff role required.');
    }

    const publicState = this.getPublicState();
    const deptKeys: OPDDepartment[] = ['General Medicine', 'Cardiology', 'Orthopaedics'];
    const allEtas = new Map<string, {
      position: number;
      totalAhead: number;
      estimatedWaitMinutes: number | null;
      etaUnavailable: boolean;
      etaReason?: string;
    }>();

    for (const dept of deptKeys) {
      const deptEtas = this.calculateDepartmentETAs(dept);
      deptEtas.forEach((v, k) => allEtas.set(k, v));
    }

    const clinicalPatients: PatientRecord[] = this.patients.map((p) => {
      const eta = allEtas.get(p.id);
      return {
        ...p,
        position: p.status === 'WAITING' ? eta?.position : (p.status === 'SERVING' ? 0 : undefined),
        totalAhead: p.status === 'WAITING' ? eta?.totalAhead : 0,
        estimatedWaitMinutes: p.status === 'WAITING'
          ? (eta ? eta.estimatedWaitMinutes : null)
          : (p.status === 'SERVING' || p.status === 'COMPLETED' ? 0 : null),
        etaUnavailable: eta ? eta.etaUnavailable : false,
        etaReason: eta ? eta.etaReason : undefined,
      };
    });

    return {
      patients: clinicalPatients,
      departments: publicState.departments,
      lastUpdated: publicState.lastUpdated,
      systemMetrics: publicState.systemMetrics,
    };
  }

  /**
   * Patient self-lookup by their own token or pass ID.
   * Returns their own record with live queue position, but cannot view other patients' records.
   */
  public getPatientSelfView(tokenOrId: string): PatientQueueView | null {
    const query = tokenOrId.trim().toUpperCase();
    const patient = findPatientByQuery(query) || this.patients.find(
      (p) =>
        p.token.toUpperCase() === query ||
        p.passId.toUpperCase() === query ||
        p.id.toUpperCase() === query ||
        (p.mrn && p.mrn.toUpperCase() === query)
    );

    if (!patient) return null;

    const deptPatients = this.patients.filter((p) => p.department === patient.department);
    const serving = deptPatients.find((p) => p.status === 'SERVING') || null;

    let position = 0;
    let totalAhead = 0;
    let estimatedWaitMinutes: number | null = 0;
    let etaUnavailable = false;
    let etaReason: string | undefined = undefined;

    if (patient.status === 'SERVING') {
      position = 0;
      totalAhead = 0;
      estimatedWaitMinutes = 0;
      etaUnavailable = false;
    } else if (patient.status === 'COMPLETED') {
      position = 0;
      totalAhead = 0;
      estimatedWaitMinutes = 0;
      etaUnavailable = false;
    } else if (patient.status === 'CANCELLED' || patient.status === 'ABSENT') {
      position = 0;
      totalAhead = 0;
      estimatedWaitMinutes = null;
      etaUnavailable = true;
      etaReason = 'Queue Entry Cancelled or Marked Absent';
    } else if (patient.passStatus === 'expired' || patient.passStatus === 'revoked') {
      position = 0;
      totalAhead = 0;
      estimatedWaitMinutes = null;
      etaUnavailable = true;
      etaReason = `Patient Pass ${patient.passStatus?.toUpperCase()}`;
    } else if (patient.status === 'HOLD_LAB') {
      position = 0;
      totalAhead = 0;
      estimatedWaitMinutes = null;
      etaUnavailable = true;
      etaReason = 'Awaiting Diagnostic Lab / X-Ray Clearance';
    } else if (patient.status === 'WAITING') {
      const deptEtas = this.calculateDepartmentETAs(patient.department);
      const myEta = deptEtas.get(patient.id);
      if (myEta) {
        position = myEta.position;
        totalAhead = myEta.totalAhead;
        estimatedWaitMinutes = myEta.estimatedWaitMinutes;
        etaUnavailable = myEta.etaUnavailable;
        etaReason = myEta.etaReason;
      } else {
        position = 1;
        totalAhead = 0;
        estimatedWaitMinutes = 0;
      }
    }

    return {
      ...patient,
      position,
      totalAhead,
      nowServingToken: serving ? serving.token : null,
      estimatedWaitMinutes,
      etaUnavailable,
      etaReason,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Protected clinical patient chart lookup: requires clinical staff authorization
   */
  public getClinicalPatientRecord(tokenOrId: string, role?: StaffRole): PatientRecord | null {
    if (role !== 'clinical') {
      throw new Error('Access denied: Clinical role required to view patient chart.');
    }
    const query = tokenOrId.trim().toUpperCase();
    return (
      findPatientByQuery(query) ||
      this.patients.find(
        (p) =>
          p.token.toUpperCase() === query ||
          p.passId.toUpperCase() === query ||
          p.id.toUpperCase() === query
      ) ||
      null
    );
  }

  public registerPatient(payload: RegistrationPayload): PatientQueueView {
    const dept = payload.department in DEPARTMENT_CONFIGS ? payload.department : 'General Medicine';
    const config = DEPARTMENT_CONFIGS[dept];

    // Determine sequential token number
    const deptPatients = this.patients.filter((p) => p.department === dept);
    let nextNum = 45;
    if (dept === 'Cardiology') nextNum = 15;
    if (dept === 'Orthopaedics') nextNum = 27;

    for (const p of deptPatients) {
      const match = p.token.match(/\d+$/);
      if (match) {
        const n = parseInt(match[0], 10);
        if (n >= nextNum) nextNum = n + 1;
      }
    }

    // Generate unique sequential token number checked against SQLite and in-memory state
    let token = `${config.prefix}-${String(nextNum).padStart(3, '0')}`;
    while (isTokenExists(token) || this.patients.some((p) => p.token === token)) {
      nextNum++;
      token = `${config.prefix}-${String(nextNum).padStart(3, '0')}`;
    }

    // Generate unique Patient ID checked against SQLite
    let id = `SJH-2025-${Math.floor(1000 + Math.random() * 9000)}`;
    while (isIdExists(id) || this.patients.some((p) => p.id === id)) {
      id = `SJH-2025-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // Cryptographically secure, unguessable pass token with guaranteed uniqueness
    let passId = generateSecurePassId();
    while (isPassTokenExists(passId) || this.patients.some((p) => p.passId === passId)) {
      passId = generateSecurePassId();
    }

    const now = Date.now();
    // Exactly 30 days validity period
    const passExpiry = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();

    let triageSeverity: TriageSeverity = 'Routine';
    const complaintLower = (payload.chiefComplaint || '').toLowerCase();
    const urgentKeywords = ['chest pain', 'severe', 'acute', 'fracture', 'shortness of breath', 'bleeding', 'unconscious', 'emergency'];

    if (urgentKeywords.some((k) => complaintLower.includes(k))) {
      triageSeverity = 'Urgent Priority';
    } else if (payload.age >= 65) {
      triageSeverity = 'Senior Priority';
    } else if (payload.age <= 12) {
      triageSeverity = 'Pediatric Fast-Track';
    }

    const newRecord: PatientRecord = {
      id,
      token,
      passId,
      passExpiry,
      passStatus: 'active',
      fullName: payload.fullName.trim(),
      age: Number(payload.age) || 30,
      gender: payload.gender || 'Not Specified',
      contactNumber: payload.contactNumber.trim(),
      mrn: payload.mrn ? payload.mrn.trim() : undefined,
      department: dept,
      room: config.room,
      doctor: config.doctor,
      chiefComplaint: payload.chiefComplaint.trim(),
      allergies: payload.allergies && payload.allergies.length > 0 ? payload.allergies : ['None reported'],
      status: 'WAITING',
      triageSeverity,
      location: 'Waiting Hall B',
      registeredAt: new Date(now).toISOString(),
    };

    // Insert into SQLite database transactionally
    insertPatientRecord(newRecord);
    this.syncFromDb();

    return this.getPatientSelfView(newRecord.token)!;
  }

  public callNext(department: OPDDepartment, role?: StaffRole): { previous: PatientRecord | null; current: PatientRecord | null } {
    if (role !== 'clinical') {
      throw new Error('Access denied: Clinical staff role required to call patients.');
    }

    const config = DEPARTMENT_CONFIGS[department];
    const currentServing = this.patients.find((p) => p.department === department && p.status === 'SERVING');
    if (currentServing) {
      updateQueueEntry(currentServing.token, {
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
        location: 'Discharged / Consultation Complete',
      });
    }

    const waitingList = this.patients.filter(
      (p) => p.department === department && p.status === 'WAITING' && p.passStatus !== 'expired' && p.passStatus !== 'revoked'
    );
    waitingList.sort(compareQueuePriority);

    const nextPatient = waitingList[0] || null;
    if (nextPatient) {
      updateQueueEntry(nextPatient.token, {
        status: 'SERVING',
        calledAt: new Date().toISOString(),
        location: `Consultation ${config.room}`,
      });
    }

    this.syncFromDb();
    const updatedServing = nextPatient ? this.patients.find((p) => p.token === nextPatient.token) || null : null;
    const updatedPrev = currentServing ? this.patients.find((p) => p.token === currentServing.token) || null : null;
    return { previous: updatedPrev, current: updatedServing };
  }

  public completeConsultation(department: OPDDepartment, role?: StaffRole): PatientRecord | null {
    if (role !== 'clinical') {
      throw new Error('Access denied: Clinical staff role required to complete consultation.');
    }

    const currentServing = this.patients.find((p) => p.department === department && p.status === 'SERVING');
    if (currentServing) {
      updateQueueEntry(currentServing.token, {
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
        location: 'Discharged / Consultation Complete',
      });
      this.syncFromDb();
      return this.patients.find((p) => p.token === currentServing.token) || null;
    }
    return null;
  }

  public holdForLab(token: string, role?: StaffRole): PatientRecord | null {
    if (role !== 'clinical') {
      throw new Error('Access denied: Clinical staff role required to place lab hold.');
    }

    const updated = updateQueueEntry(token, {
      status: 'HOLD_LAB',
      location: 'Diagnostic Lab / X-Ray Annex',
    });

    if (updated) {
      this.syncFromDb();
      return this.patients.find((p) => p.token.toUpperCase() === token.toUpperCase()) || null;
    }
    return null;
  }

  public callSpecificToken(token: string, role?: StaffRole): PatientRecord | null {
    if (role !== 'clinical') {
      throw new Error('Access denied: Clinical staff role required to call token.');
    }

    const target = this.patients.find((p) => p.token.toUpperCase() === token.toUpperCase());
    if (!target) return null;

    const dept = target.department;
    const config = DEPARTMENT_CONFIGS[dept];
    const currentServing = this.patients.find((p) => p.department === dept && p.status === 'SERVING');
    if (currentServing && currentServing.id !== target.id) {
      updateQueueEntry(currentServing.token, {
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
        location: 'Discharged',
      });
    }

    updateQueueEntry(target.token, {
      status: 'SERVING',
      calledAt: new Date().toISOString(),
      location: `Consultation ${config.room}`,
    });

    this.syncFromDb();
    return this.patients.find((p) => p.token.toUpperCase() === token.toUpperCase()) || null;
  }

  /**
   * Secure Gate Pass Verification:
   * - Requires authenticated staff role ('security' or 'clinical').
   * - Returns ONLY GateClearanceDTO with masked name and operational details.
   * - Strictly excludes contactNumber, MRN, chiefComplaint, allergies, and clinical notes.
   * - Evaluates true server-side expiration (30 days from issue).
   * - Evaluates true server-side revocation.
   * - Detects duplicate scans within a 5-minute cooldown window.
   * - Logs every scan event persistently in SQLite.
   */
  public verifyGatePass(
    code: string,
    role: StaffRole,
    operatorId = 'SEC-402',
    gateId = 'Gate 02'
  ): GateClearanceDTO {
    if (role !== 'security' && role !== 'clinical') {
      throw new Error('Unauthorized: Valid Security or Clinical credentials required for gate access verification.');
    }

    const now = new Date();
    const scanTimestamp = now.toISOString();
    const query = code.trim().toUpperCase();

    if (!query) {
      const entry: GateScanLogEntry = {
        id: crypto.randomUUID(),
        passIdOrCode: 'EMPTY',
        outcome: 'INVALID',
        timestamp: scanTimestamp,
        operatorId,
        gateId,
        isDuplicate: false,
      };
      insertScanLog(entry);
      this.syncFromDb();
      return {
        outcome: 'INVALID',
        message: 'Empty pass code presented.',
        scanTimestamp,
      };
    }

    // Look up patient matching passId or token from SQLite
    const patient = findPatientByQuery(query) || this.patients.find(
      (p) => p.passId.toUpperCase() === query || p.token.toUpperCase() === query
    );

    if (!patient) {
      const entry: GateScanLogEntry = {
        id: crypto.randomUUID(),
        passIdOrCode: query.substring(0, 32),
        outcome: 'INVALID',
        timestamp: scanTimestamp,
        operatorId,
        gateId,
        isDuplicate: false,
      };
      insertScanLog(entry);
      this.syncFromDb();
      return {
        outcome: 'INVALID',
        message: 'Unrecognized pass or token. Non-SmartQueue signature.',
        scanTimestamp,
      };
    }

    const maskedName = maskFullName(patient.fullName);

    // 1. Evaluate True Expiration (Date.now() > passExpiry or explicit status)
    const expiryMs = new Date(patient.passExpiry).getTime();
    if (Date.now() > expiryMs || patient.passStatus === 'expired') {
      const entry: GateScanLogEntry = {
        id: crypto.randomUUID(),
        passIdOrCode: patient.passId,
        outcome: 'EXPIRED',
        timestamp: scanTimestamp,
        operatorId,
        gateId,
        patientNameMasked: maskedName,
        token: patient.token,
        isDuplicate: false,
      };
      insertScanLog(entry);
      this.syncFromDb();

      return {
        outcome: 'EXPIRED',
        message: `Pass expired on ${new Date(patient.passExpiry).toLocaleDateString()}. Re-checkin required at Central OPD Desk.`,
        passId: patient.passId,
        token: patient.token,
        patientNameMasked: maskedName,
        passExpiry: patient.passExpiry,
        scanTimestamp,
      };
    }

    // 2. Evaluate True Revocation
    if (patient.passStatus === 'revoked') {
      const entry: GateScanLogEntry = {
        id: crypto.randomUUID(),
        passIdOrCode: patient.passId,
        outcome: 'REVOKED',
        timestamp: scanTimestamp,
        operatorId,
        gateId,
        patientNameMasked: maskedName,
        token: patient.token,
        isDuplicate: false,
      };
      insertScanLog(entry);
      this.syncFromDb();

      return {
        outcome: 'REVOKED',
        message: 'Pass revoked / flagged by hospital security. Entry suspended; escort required.',
        passId: patient.passId,
        token: patient.token,
        patientNameMasked: maskedName,
        scanTimestamp,
      };
    }

    // 3. Safe Duplicate Scan Detection (5-minute cooldown window)
    const DUPLICATE_COOLDOWN_MS = 5 * 60 * 1000;
    const recentScan = this.scanLogs
      .slice()
      .reverse()
      .find(
        (log) =>
          log.passIdOrCode.toUpperCase() === patient.passId.toUpperCase() &&
          log.outcome === 'VALID' &&
          now.getTime() - new Date(log.timestamp).getTime() < DUPLICATE_COOLDOWN_MS
      );

    const isDuplicate = !!recentScan;
    let duplicateWarning: string | undefined = undefined;

    if (isDuplicate && recentScan) {
      const elapsedSeconds = Math.max(1, Math.round((now.getTime() - new Date(recentScan.timestamp).getTime()) / 1000));
      const elapsedMins = Math.floor(elapsedSeconds / 60);
      const timeStr = elapsedMins > 0 ? `${elapsedMins}m ${elapsedSeconds % 60}s` : `${elapsedSeconds}s`;
      duplicateWarning = `Duplicate scan detected: Pass was already verified ${timeStr} ago at ${recentScan.gateId}. Verify visitor credentials.`;
    }

    // Record verified scan log into SQLite
    const entry: GateScanLogEntry = {
      id: crypto.randomUUID(),
      passIdOrCode: patient.passId,
      outcome: 'VALID',
      timestamp: scanTimestamp,
      operatorId,
      gateId,
      patientNameMasked: maskedName,
      token: patient.token,
      isDuplicate,
    };
    insertScanLog(entry);
    this.syncFromDb();

    // Return sanitized operational DTO - strictly NO clinical details
    return {
      outcome: 'VALID',
      message: isDuplicate
        ? 'Access verified with duplicate warning.'
        : 'Access granted. Clearance Level: Tier-1 Ambulatory.',
      passId: patient.passId,
      token: patient.token,
      patientNameMasked: maskedName,
      department: patient.department,
      room: patient.room,
      passExpiry: patient.passExpiry,
      clearanceLevel: 'Tier-1 Ambulatory',
      scanTimestamp,
      isDuplicateScan: isDuplicate,
      duplicateWarning,
    };
  }

  public getRecentScanLogs(limit = 15): GateScanLogEntry[] {
    return getRecentScanLogsFromDb(limit);
  }

  /**
   * Update a patient's pass status (active/expired/revoked) in SQLite.
   * Requires Security or Clinical staff authorization.
   */
  public updatePassStatus(
    tokenOrPassId: string,
    status: 'active' | 'expired' | 'revoked',
    role?: StaffRole
  ): { success: boolean; patient: PatientQueueView | null } {
    if (role !== 'security' && role !== 'clinical') {
      throw new Error('Access denied: Staff authorization required to update pass status.');
    }

    const query = tokenOrPassId.trim().toUpperCase();
    const patient = findPatientByQuery(query) || this.patients.find(
      (p) => p.passId.toUpperCase() === query || p.token.toUpperCase() === query || p.id.toUpperCase() === query
    );

    if (!patient) {
      return { success: false, patient: null };
    }

    let newExpiry: string | undefined = undefined;
    if (status === 'expired') {
      newExpiry = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    } else if (status === 'active') {
      newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    updatePassStatusDb(patient.passId, status, newExpiry);
    this.syncFromDb();

    return { success: true, patient: this.getPatientSelfView(patient.token) };
  }

  /**
   * Update clinical consultation notes for a patient.
   * Requires Clinical staff authorization.
   */
  public updatePatientNotes(
    tokenOrId: string,
    notes: string,
    role?: StaffRole
  ): { success: boolean; patient: PatientRecord | null } {
    if (role !== 'clinical') {
      throw new Error('Access denied: Clinical staff authorization required to update notes.');
    }

    const updated = updatePatientNotesInDb(tokenOrId, notes);
    if (updated) {
      this.syncFromDb();
      const patient = this.getClinicalPatientRecord(tokenOrId, 'clinical');
      return { success: true, patient };
    }
    return { success: false, patient: null };
  }
}

export const queueDb = new QueueDatabase();
