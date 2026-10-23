import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  OPDDepartment,
  PatientRecord,
  QueueStatus,
  TriageSeverity,
  GateScanLogEntry,
} from '../src/types/queue';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultDataDir = path.resolve(__dirname, '../data');

// Allow custom database file path or custom data directory via environment variables
export const DB_PATH = process.env.SQLITE_DB_PATH
  ? path.resolve(process.env.SQLITE_DB_PATH)
  : (process.env.DATA_DIR || process.env.SMARTQUEUE_DATA_DIR)
  ? path.resolve(process.env.DATA_DIR || process.env.SMARTQUEUE_DATA_DIR!, 'smartqueue.db')
  : path.join(defaultDataDir, 'smartqueue.db');

export const DATA_DIR = path.dirname(DB_PATH);
export const BACKUP_DIR = process.env.SQLITE_BACKUP_DIR
  ? path.resolve(process.env.SQLITE_BACKUP_DIR)
  : path.join(DATA_DIR, 'backups');

let dbInstance: Database.Database | null = null;

/**
 * Obtain or initialize the SQLite database connection with WAL mode and foreign keys enabled.
 */
export function getDb(): Database.Database {
  if (!dbInstance) {
    const parentDir = path.dirname(DB_PATH);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // If a custom DB_PATH is specified (e.g. on a persistent disk) and the destination
    // DB does not exist yet, but a local database exists at defaultDataDir, copy it over
    // so existing records and state are never left behind.
    const defaultDbPath = path.join(defaultDataDir, 'smartqueue.db');
    if (DB_PATH !== defaultDbPath && !fs.existsSync(DB_PATH) && fs.existsSync(defaultDbPath)) {
      try {
        console.log(`[SQLite] Copying existing database from ${defaultDbPath} to persistent path ${DB_PATH}...`);
        fs.copyFileSync(defaultDbPath, DB_PATH);
      } catch (copyErr) {
        console.warn('[SQLite] Could not copy existing database file to custom path:', copyErr);
      }
    }

    dbInstance = new Database(DB_PATH);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
    dbInstance.pragma('synchronous = NORMAL');
    initSchema(dbInstance);
  }
  return dbInstance;
}

/**
 * Close database connection if open.
 */
export function closeDb(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // ignore
    }
    dbInstance = null;
  }
}

/**
 * Initialize relational schema: patients, patient_passes, queue_entries, gate_scan_logs
 */
function initSchema(db: Database.Database): void {
  db.exec(`
    -- 1. Patients Table: Legal profile & clinical record
    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      age INTEGER NOT NULL,
      gender TEXT NOT NULL DEFAULT 'Not Specified',
      contact_number TEXT NOT NULL,
      mrn TEXT,
      chief_complaint TEXT NOT NULL,
      allergies TEXT NOT NULL DEFAULT '["None reported"]',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 2. Patient Passes Table: 30-day QR token and validity state
    CREATE TABLE IF NOT EXISTS patient_passes (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      pass_token TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
      issued_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      revocation_reason TEXT,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_passes_token ON patient_passes(pass_token);
    CREATE INDEX IF NOT EXISTS idx_passes_patient ON patient_passes(patient_id);

    -- 3. Queue Entries Table: OPD departmental queue status and triage
    CREATE TABLE IF NOT EXISTS queue_entries (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      department TEXT NOT NULL CHECK (department IN ('General Medicine', 'Cardiology', 'Orthopaedics')),
      room TEXT NOT NULL,
      doctor TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING', 'SERVING', 'HOLD_LAB', 'COMPLETED', 'CANCELLED')),
      triage_severity TEXT NOT NULL DEFAULT 'Routine' CHECK (triage_severity IN ('Routine', 'Urgent Priority', 'Senior Priority', 'Pediatric Fast-Track')),
      location TEXT NOT NULL DEFAULT 'Waiting Hall B',
      priority_score INTEGER NOT NULL DEFAULT 0,
      registered_at TEXT NOT NULL,
      called_at TEXT,
      completed_at TEXT,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_queue_token ON queue_entries(token);
    CREATE INDEX IF NOT EXISTS idx_queue_dept_status ON queue_entries(department, status);
    CREATE INDEX IF NOT EXISTS idx_queue_patient ON queue_entries(patient_id);

    -- 4. Gate Scan Logs Table: Append-only security audit log
    CREATE TABLE IF NOT EXISTS gate_scan_logs (
      id TEXT PRIMARY KEY,
      pass_token TEXT NOT NULL,
      patient_id TEXT,
      outcome TEXT NOT NULL CHECK (outcome IN ('VALID', 'EXPIRED', 'REVOKED', 'INVALID')),
      gate_id TEXT NOT NULL DEFAULT 'Gate 02',
      operator_id TEXT NOT NULL DEFAULT 'SEC-402',
      timestamp TEXT NOT NULL,
      is_duplicate INTEGER NOT NULL DEFAULT 0 CHECK (is_duplicate IN (0, 1)),
      warning_message TEXT,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_scans_token ON gate_scan_logs(pass_token);
    CREATE INDEX IF NOT EXISTS idx_scans_timestamp ON gate_scan_logs(timestamp);
  `);
}

/**
 * Row type returned when joining patients, patient_passes, and queue_entries.
 */
interface PatientJoinedRow {
  id: string;
  full_name: string;
  age: number;
  gender: string;
  contact_number: string;
  mrn: string | null;
  chief_complaint: string;
  allergies: string;
  notes: string | null;
  pass_token: string;
  pass_status: 'active' | 'expired' | 'revoked';
  expires_at: string;
  token: string;
  department: OPDDepartment;
  room: string;
  doctor: string;
  status: QueueStatus;
  triage_severity: TriageSeverity;
  location: string;
  registered_at: string;
  called_at: string | null;
  completed_at: string | null;
}

function rowToPatientRecord(row: PatientJoinedRow): PatientRecord {
  let parsedAllergies: string[] = ['None reported'];
  try {
    if (row.allergies) {
      const parsed = JSON.parse(row.allergies);
      if (Array.isArray(parsed)) parsedAllergies = parsed;
    }
  } catch {
    parsedAllergies = [row.allergies];
  }

  return {
    id: row.id,
    token: row.token,
    passId: row.pass_token,
    passExpiry: row.expires_at,
    passStatus: row.pass_status,
    fullName: row.full_name,
    age: row.age,
    gender: row.gender,
    contactNumber: row.contact_number,
    mrn: row.mrn || undefined,
    department: row.department,
    room: row.room,
    doctor: row.doctor,
    chiefComplaint: row.chief_complaint,
    allergies: parsedAllergies,
    status: row.status,
    triageSeverity: row.triage_severity,
    location: row.location,
    registeredAt: row.registered_at,
    calledAt: row.called_at || undefined,
    completedAt: row.completed_at || undefined,
    notes: row.notes || undefined,
  };
}

const SELECT_JOINED_PATIENTS = `
  SELECT 
    p.id,
    p.full_name,
    p.age,
    p.gender,
    p.contact_number,
    p.mrn,
    p.chief_complaint,
    p.allergies,
    p.notes,
    pass.pass_token,
    pass.status AS pass_status,
    pass.expires_at,
    q.token,
    q.department,
    q.room,
    q.doctor,
    q.status,
    q.triage_severity,
    q.location,
    q.registered_at,
    q.called_at,
    q.completed_at
  FROM patients p
  JOIN queue_entries q ON q.patient_id = p.id
  JOIN patient_passes pass ON pass.patient_id = p.id
`;

/**
 * Retrieve all patient records from SQLite with full join.
 */
export function getAllPatients(): PatientRecord[] {
  const db = getDb();
  const stmt = db.prepare(`${SELECT_JOINED_PATIENTS} ORDER BY q.registered_at ASC`);
  const rows = stmt.all() as PatientJoinedRow[];
  return rows.map(rowToPatientRecord);
}

/**
 * Find a patient record by token, passId, patient ID, or MRN.
 */
export function findPatientByQuery(query: string): PatientRecord | null {
  const db = getDb();
  const trimmed = query.trim().toUpperCase();
  const stmt = db.prepare(`
    ${SELECT_JOINED_PATIENTS}
    WHERE UPPER(q.token) = ?
       OR UPPER(pass.pass_token) = ?
       OR UPPER(p.id) = ?
       OR (p.mrn IS NOT NULL AND UPPER(p.mrn) = ?)
    LIMIT 1
  `);
  const row = stmt.get(trimmed, trimmed, trimmed, trimmed) as PatientJoinedRow | undefined;
  return row ? rowToPatientRecord(row) : null;
}

/**
 * Check uniqueness in SQLite.
 */
export function isIdExists(id: string): boolean {
  const db = getDb();
  const row = db.prepare('SELECT 1 FROM patients WHERE id = ?').get(id);
  return !!row;
}

export function isTokenExists(token: string): boolean {
  const db = getDb();
  const row = db.prepare('SELECT 1 FROM queue_entries WHERE token = ?').get(token);
  return !!row;
}

export function isPassTokenExists(passToken: string): boolean {
  const db = getDb();
  const row = db.prepare('SELECT 1 FROM patient_passes WHERE pass_token = ?').get(passToken);
  return !!row;
}

/**
 * Insert a full patient record into SQLite across patients, patient_passes, and queue_entries
 * atomically using a transaction.
 */
export function insertPatientRecord(record: PatientRecord): void {
  const db = getDb();
  const passId = `pass-${crypto.randomUUID()}`;
  const queueId = `qe-${crypto.randomUUID()}`;

  const insertPatient = db.prepare(`
    INSERT INTO patients (id, full_name, age, gender, contact_number, mrn, chief_complaint, allergies, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertPass = db.prepare(`
    INSERT INTO patient_passes (id, patient_id, pass_token, status, expires_at, issued_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertQueue = db.prepare(`
    INSERT INTO queue_entries (id, patient_id, token, department, room, doctor, status, triage_severity, location, registered_at, called_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    insertPatient.run(
      record.id,
      record.fullName,
      record.age,
      record.gender,
      record.contactNumber,
      record.mrn || null,
      record.chiefComplaint,
      JSON.stringify(record.allergies || ['None reported']),
      record.notes || null,
      record.registeredAt || new Date().toISOString()
    );

    insertPass.run(
      passId,
      record.id,
      record.passId,
      record.passStatus || 'active',
      record.passExpiry,
      record.registeredAt || new Date().toISOString()
    );

    insertQueue.run(
      queueId,
      record.id,
      record.token,
      record.department,
      record.room,
      record.doctor,
      record.status,
      record.triageSeverity,
      record.location,
      record.registeredAt,
      record.calledAt || null,
      record.completedAt || null
    );
  });

  tx();
}

/**
 * Update queue entry status (e.g. SERVING, COMPLETED, HOLD_LAB).
 */
export function updateQueueEntry(
  token: string,
  updates: {
    status: QueueStatus;
    calledAt?: string;
    completedAt?: string;
    location?: string;
  }
): boolean {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE queue_entries
    SET status = ?,
        called_at = COALESCE(?, called_at),
        completed_at = COALESCE(?, completed_at),
        location = COALESCE(?, location)
    WHERE token = ?
  `);
  const result = stmt.run(
    updates.status,
    updates.calledAt || null,
    updates.completedAt || null,
    updates.location || null,
    token
  );
  return result.changes > 0;
}

/**
 * Update pass status (active/expired/revoked) and expiration timestamp.
 */
export function updatePassStatusDb(
  passTokenOrPatientToken: string,
  status: 'active' | 'expired' | 'revoked',
  expiresAt?: string
): boolean {
  const db = getDb();
  const query = passTokenOrPatientToken.trim().toUpperCase();

  const stmt = db.prepare(`
    UPDATE patient_passes
    SET status = ?,
        expires_at = COALESCE(?, expires_at),
        revoked_at = CASE WHEN ? = 'revoked' THEN datetime('now') ELSE NULL END
    WHERE UPPER(pass_token) = ?
       OR patient_id IN (
         SELECT patient_id FROM queue_entries WHERE UPPER(token) = ?
       )
       OR patient_id IN (
         SELECT id FROM patients WHERE UPPER(id) = ?
       )
  `);

  const result = stmt.run(status, expiresAt || null, status, query, query, query);
  return result.changes > 0;
}

/**
 * Update clinical consultation notes for a patient in SQLite.
 */
export function updatePatientNotes(query: string, notes: string): boolean {
  const db = getDb();
  const trimmed = query.trim().toUpperCase();
  const stmt = db.prepare(`
    UPDATE patients
    SET notes = ?
    WHERE UPPER(id) = ?
       OR (mrn IS NOT NULL AND UPPER(mrn) = ?)
       OR id IN (
         SELECT patient_id FROM queue_entries WHERE UPPER(token) = ?
       )
       OR id IN (
         SELECT patient_id FROM patient_passes WHERE UPPER(pass_token) = ?
       )
  `);
  const result = stmt.run(notes, trimmed, trimmed, trimmed, trimmed);
  return result.changes > 0;
}

/**
 * Insert a gate scan audit log entry into SQLite.
 */
export function insertScanLog(entry: GateScanLogEntry): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO gate_scan_logs (id, pass_token, patient_id, outcome, gate_id, operator_id, timestamp, is_duplicate, warning_message)
    VALUES (?, ?, (SELECT patient_id FROM patient_passes WHERE UPPER(pass_token) = UPPER(?) LIMIT 1), ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    entry.id,
    entry.passIdOrCode,
    entry.passIdOrCode,
    entry.outcome,
    entry.gateId,
    entry.operatorId,
    entry.timestamp,
    entry.isDuplicate ? 1 : 0,
    entry.patientNameMasked || null
  );
}

/**
 * Retrieve recent gate scan logs.
 */
export function getRecentScanLogsFromDb(limit = 25): GateScanLogEntry[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT 
      l.id,
      l.pass_token AS passIdOrCode,
      l.outcome,
      l.timestamp,
      l.operator_id AS operatorId,
      l.gate_id AS gateId,
      l.is_duplicate AS isDuplicate,
      p.full_name AS patientFullName,
      q.token
    FROM gate_scan_logs l
    LEFT JOIN patients p ON p.id = l.patient_id
    LEFT JOIN queue_entries q ON q.patient_id = l.patient_id
    ORDER BY l.timestamp DESC
    LIMIT ?
  `);
  const rows = stmt.all(limit) as Array<{
    id: string;
    passIdOrCode: string;
    outcome: 'VALID' | 'EXPIRED' | 'REVOKED' | 'INVALID';
    timestamp: string;
    operatorId: string;
    gateId: string;
    isDuplicate: number;
    patientFullName: string | null;
    token: string | null;
  }>;

  return rows.map((r) => {
    let maskedName: string | undefined = undefined;
    if (r.patientFullName) {
      const parts = r.patientFullName.trim().split(/\s+/);
      maskedName = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1].charAt(0)}.` : parts[0];
    }
    return {
      id: r.id,
      passIdOrCode: r.passIdOrCode,
      outcome: r.outcome,
      timestamp: r.timestamp,
      operatorId: r.operatorId,
      gateId: r.gateId,
      isDuplicate: r.isDuplicate === 1,
      patientNameMasked: maskedName,
      token: r.token || undefined,
    };
  });
}

/**
 * Safely migrate records from legacy JSON files into SQLite if SQLite has 0 records.
 */
export function migrateFromJsonIfEmpty(seedGenerator: () => PatientRecord[]): void {
  const db = getDb();
  const countRow = db.prepare('SELECT COUNT(*) AS count FROM patients').get() as { count: number };
  if (countRow && countRow.count > 0) {
    // Already populated, no migration needed
    return;
  }

  console.log('[SQLite] Database is empty. Initiating initial population...');
  let recordsToInsert: PatientRecord[] = [];

  const legacyJsonPath = fs.existsSync(path.join(DATA_DIR, 'smartqueue.json'))
    ? path.join(DATA_DIR, 'smartqueue.json')
    : path.join(defaultDataDir, 'smartqueue.json');

  if (fs.existsSync(legacyJsonPath)) {
    try {
      const raw = fs.readFileSync(legacyJsonPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        recordsToInsert = parsed;
        console.log(`[SQLite] Migrating ${parsed.length} existing records from ${legacyJsonPath}`);
      }
    } catch (err) {
      console.warn('[SQLite] Could not read legacy smartqueue.json, falling back to seed generator', err);
    }
  }

  if (recordsToInsert.length === 0) {
    recordsToInsert = seedGenerator();
    console.log(`[SQLite] Seeded ${recordsToInsert.length} initial synthetic demo records.`);
  }

  // Ensure explicit fixtures are present
  const seeds = seedGenerator();
  for (const s of seeds) {
    if (!recordsToInsert.some((r) => r.token === s.token || r.passId === s.passId)) {
      recordsToInsert.push(s);
    }
  }

  for (const rec of recordsToInsert) {
    insertPatientRecord(rec);
  }

  // Migrate scan logs if available
  const legacyScansPath = fs.existsSync(path.join(DATA_DIR, 'gate_scans.json'))
    ? path.join(DATA_DIR, 'gate_scans.json')
    : path.join(defaultDataDir, 'gate_scans.json');

  if (fs.existsSync(legacyScansPath)) {
    try {
      const rawScans = fs.readFileSync(legacyScansPath, 'utf-8');
      const parsedScans = JSON.parse(rawScans);
      if (Array.isArray(parsedScans)) {
        for (const scan of parsedScans) {
          try {
            insertScanLog(scan);
          } catch {
            // ignore scan migration collisions
          }
        }
        console.log(`[SQLite] Migrated ${parsedScans.length} historical scan logs from gate_scans.json`);
      }
    } catch (err) {
      console.warn('[SQLite] Could not read legacy gate_scans.json', err);
    }
  }
}

/**
 * Reset database to demo initial state.
 */
export function resetDatabase(seeds: PatientRecord[]): void {
  const db = getDb();
  const tx = db.transaction(() => {
    db.exec('DELETE FROM gate_scan_logs;');
    db.exec('DELETE FROM queue_entries;');
    db.exec('DELETE FROM patient_passes;');
    db.exec('DELETE FROM patients;');
    for (const s of seeds) {
      insertPatientRecord(s);
    }
  });
  tx();
  console.log(`[SQLite] Reset database completed with ${seeds.length} demo records.`);
}

/**
 * Create a timestamped backup of the SQLite database.
 */
export function backupDatabase(): string {
  const db = getDb();
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `smartqueue-backup-${timestamp}.db`;
  const backupFilePath = path.join(BACKUP_DIR, backupFileName);

  db.backup(backupFilePath)
    .then(() => {
      console.log(`[SQLite] Database backup created successfully at: ${backupFilePath}`);
    })
    .catch((err) => {
      console.error('[SQLite] Backup failed:', err);
    });

  return backupFilePath;
}
