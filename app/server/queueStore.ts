import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  OPDDepartment,
  PatientRecord,
  PatientQueueView,
  DepartmentSummary,
  SmartQueueState,
  RegistrationPayload,
  TriageSeverity,
} from '../src/types/queue';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'smartqueue.json');

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

function generateInitialSeed(): PatientRecord[] {
  const now = Date.now();
  const thirtyDaysAhead = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();

  return [
    // General Medicine (Serving + Waiting)
    {
      id: 'SJH-2025-8821',
      token: 'MED-039',
      passId: 'SQ-PASS-88210-B',
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
      passId: 'SQ-PASS-88320-B',
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
      passId: 'SQ-PASS-88370-B',
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
      passId: 'SQ-PASS-90412-B',
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
      passId: 'SQ-PASS-90460-B',
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
      passId: 'SQ-PASS-90500-B',
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
      passId: 'SQ-PASS-77110-B',
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
      passId: 'SQ-PASS-77190-B',
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
      passId: 'SQ-PASS-77240-B',
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
      passId: 'SQ-PASS-66100-B',
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
      passId: 'SQ-PASS-66180-B',
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
      passId: 'SQ-PASS-66220-B',
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
  ];
}

class QueueDatabase {
  private patients: PatientRecord[] = [];

  constructor() {
    this.ensureDataFile();
  }

  private ensureDataFile() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.patients = parsed;
          return;
        }
      }
    } catch (err) {
      console.warn('Error reading data file, initializing fresh seed', err);
    }
    // Initialize fresh seed
    this.patients = generateInitialSeed();
    this.persist();
  }

  private persist() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.patients, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist database to file:', err);
    }
  }

  public resetDemo() {
    this.patients = generateInitialSeed();
    this.persist();
    return this.getState();
  }

  public getState(): SmartQueueState {
    const deptKeys: OPDDepartment[] = ['General Medicine', 'Cardiology', 'Orthopaedics'];
    const departments = {} as Record<OPDDepartment, DepartmentSummary>;

    let totalWaiting = 0;
    let totalServed = 0;
    let totalLab = 0;
    let totalWaitTimeAccum = 0;
    let waitTimeCount = 0;

    for (const dept of deptKeys) {
      const config = DEPARTMENT_CONFIGS[dept];
      const deptPatients = this.patients.filter((p) => p.department === dept);
      const serving = deptPatients.find((p) => p.status === 'SERVING') || null;
      const waiting = deptPatients.filter((p) => p.status === 'WAITING');
      const served = deptPatients.filter((p) => p.status === 'COMPLETED');
      const lab = deptPatients.filter((p) => p.status === 'HOLD_LAB');

      totalWaiting += waiting.length;
      totalServed += served.length;
      totalLab += lab.length;

      // Calculate average wait time in minutes for this department
      const deptWaitMins = Math.max(3, Math.round(waiting.length * (config.avgMinutes / config.activeDesks)));
      totalWaitTimeAccum += deptWaitMins;
      waitTimeCount++;

      let currentConsultationSeconds = 0;
      if (serving && serving.calledAt) {
        currentConsultationSeconds = Math.max(0, Math.floor((Date.now() - new Date(serving.calledAt).getTime()) / 1000));
      }

      departments[dept] = {
        department: dept,
        displayName: `${dept} (${config.room})`,
        room: config.room,
        suite: config.suite,
        doctor: config.doctor,
        active: true,
        activeDesks: config.activeDesks,
        nowServingToken: serving ? serving.token : null,
        nowServingPatient: serving,
        waitingCount: waiting.length,
        totalServedToday: 18 + served.length, // Include hospital baseline
        averageWaitMinutes: deptWaitMins,
        currentConsultationSeconds,
      };
    }

    const avgWait = waitTimeCount > 0 ? Math.round(totalWaitTimeAccum / waitTimeCount) : 16;

    return {
      patients: this.patients,
      departments,
      lastUpdated: new Date().toISOString(),
      systemMetrics: {
        totalCheckedIn: 342 + this.patients.length - 12,
        totalServed: 18 + totalServed,
        inWaiting: totalWaiting,
        atLab: 2 + totalLab,
        velocitySlaPercent: 94,
        averageWaitMinutes: avgWait,
      },
    };
  }

  public getPatientView(tokenOrId: string): PatientQueueView | null {
    const query = tokenOrId.trim().toUpperCase();
    const patient = this.patients.find(
      (p) =>
        p.token.toUpperCase() === query ||
        p.id.toUpperCase() === query ||
        p.passId.toUpperCase() === query ||
        (p.mrn && p.mrn.toUpperCase() === query)
    );

    if (!patient) return null;

    const deptConfig = DEPARTMENT_CONFIGS[patient.department];
    const deptPatients = this.patients.filter((p) => p.department === patient.department);
    const serving = deptPatients.find((p) => p.status === 'SERVING') || null;
    const waitingPatients = deptPatients.filter((p) => p.status === 'WAITING');

    let position = 0;
    let totalAhead = 0;
    let estimatedWaitMinutes = 0;

    if (patient.status === 'WAITING') {
      const idx = waitingPatients.findIndex((p) => p.id === patient.id);
      position = idx >= 0 ? idx + 1 : 1;
      totalAhead = idx >= 0 ? idx : 0;
      estimatedWaitMinutes = Math.max(2, Math.round(position * (deptConfig.avgMinutes / deptConfig.activeDesks)));
    } else if (patient.status === 'SERVING') {
      position = 0;
      totalAhead = 0;
      estimatedWaitMinutes = 0;
    } else {
      position = 0;
      totalAhead = 0;
      estimatedWaitMinutes = 0;
    }

    return {
      ...patient,
      position,
      totalAhead,
      nowServingToken: serving ? serving.token : null,
      estimatedWaitMinutes,
    };
  }

  public registerPatient(payload: RegistrationPayload): PatientQueueView {
    const dept = payload.department in DEPARTMENT_CONFIGS ? payload.department : 'General Medicine';
    const config = DEPARTMENT_CONFIGS[dept];

    // Determine token number
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

    const token = `${config.prefix}-${String(nextNum).padStart(3, '0')}`;
    const id = `SJH-2025-${Math.floor(1000 + Math.random() * 9000)}`;
    const passId = `SQ-PASS-${Math.floor(10000 + Math.random() * 90000)}-B`;
    const now = Date.now();
    const passExpiry = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Determine triage severity based on clinical heuristics
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

    this.patients.push(newRecord);
    this.persist();

    return this.getPatientView(newRecord.token)!;
  }

  public callNext(department: OPDDepartment): { previous: PatientRecord | null; current: PatientRecord | null } {
    const config = DEPARTMENT_CONFIGS[department];
    // Find currently serving in this department, if any
    const currentServing = this.patients.find((p) => p.department === department && p.status === 'SERVING');
    if (currentServing) {
      currentServing.status = 'COMPLETED';
      currentServing.completedAt = new Date().toISOString();
      currentServing.location = 'Discharged / Consultation Complete';
    }

    // Find next waiting patient in this department (respecting urgent priority first if any, or FIFO)
    const waitingList = this.patients.filter((p) => p.department === department && p.status === 'WAITING');
    // Sort urgent priority first, otherwise FIFO by registeredAt
    waitingList.sort((a, b) => {
      const aUrgent = a.triageSeverity === 'Urgent Priority' ? 1 : 0;
      const bUrgent = b.triageSeverity === 'Urgent Priority' ? 1 : 0;
      if (aUrgent !== bUrgent) return bUrgent - aUrgent;
      return new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime();
    });

    const nextPatient = waitingList[0] || null;
    if (nextPatient) {
      nextPatient.status = 'SERVING';
      nextPatient.calledAt = new Date().toISOString();
      nextPatient.location = `Consultation ${config.room}`;
    }

    this.persist();
    return { previous: currentServing || null, current: nextPatient };
  }

  public completeConsultation(department: OPDDepartment): PatientRecord | null {
    const currentServing = this.patients.find((p) => p.department === department && p.status === 'SERVING');
    if (currentServing) {
      currentServing.status = 'COMPLETED';
      currentServing.completedAt = new Date().toISOString();
      currentServing.location = 'Discharged / Consultation Complete';
      this.persist();
      return currentServing;
    }
    return null;
  }

  public holdForLab(token: string): PatientRecord | null {
    const patient = this.patients.find((p) => p.token.toUpperCase() === token.toUpperCase());
    if (patient) {
      patient.status = 'HOLD_LAB';
      patient.location = 'Diagnostic Lab / X-Ray Annex';
      this.persist();
      return patient;
    }
    return null;
  }

  public callSpecificToken(token: string): PatientRecord | null {
    const target = this.patients.find((p) => p.token.toUpperCase() === token.toUpperCase());
    if (!target) return null;

    const dept = target.department;
    const config = DEPARTMENT_CONFIGS[dept];
    // Complete previous serving
    const currentServing = this.patients.find((p) => p.department === dept && p.status === 'SERVING');
    if (currentServing && currentServing.id !== target.id) {
      currentServing.status = 'COMPLETED';
      currentServing.completedAt = new Date().toISOString();
      currentServing.location = 'Discharged';
    }

    target.status = 'SERVING';
    target.calledAt = new Date().toISOString();
    target.location = `Consultation ${config.room}`;
    this.persist();
    return target;
  }

  public verifyPassOrToken(code: string): {
    outcome: 'VALID' | 'EXPIRED' | 'REVOKED' | 'INVALID';
    patient?: PatientRecord;
    message: string;
    clearanceLevel?: string;
  } {
    const query = code.trim().toUpperCase();
    if (!query) {
      return { outcome: 'INVALID', message: 'Pass or token code is empty.' };
    }

    // Check special simulation codes
    if (query.includes('EXP')) {
      return {
        outcome: 'EXPIRED',
        message: 'Pass validity period has lapsed (Over 30 days). Patient must register for a renewal token.',
      };
    }
    if (query.includes('FLAG') || query.includes('REV')) {
      return {
        outcome: 'REVOKED',
        message: 'Pass flagged by hospital security / Infection Control. Access suspended.',
      };
    }

    const patient = this.patients.find(
      (p) =>
        p.passId.toUpperCase() === query ||
        p.token.toUpperCase() === query ||
        p.id.toUpperCase() === query
    );

    if (!patient) {
      return {
        outcome: 'INVALID',
        message: 'Unrecognized QR payload. Non-SmartQueue cryptographic signature.',
      };
    }

    // Check expiration
    const expiry = new Date(patient.passExpiry).getTime();
    if (Date.now() > expiry || patient.passStatus === 'expired') {
      return {
        outcome: 'EXPIRED',
        patient,
        message: `Pass for ${patient.fullName} expired. Please visit OPD reception desk.`,
      };
    }

    if (patient.passStatus === 'revoked') {
      return {
        outcome: 'REVOKED',
        patient,
        message: `Pass for ${patient.fullName} has been revoked by hospital triage.`,
      };
    }

    return {
      outcome: 'VALID',
      patient,
      message: 'Access granted. Clearance Level: Tier-1 Ambulatory.',
      clearanceLevel: 'Tier-1 Ambulatory',
    };
  }
}

export const queueDb = new QueueDatabase();
