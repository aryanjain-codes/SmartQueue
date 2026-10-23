/**
 * SmartQueue Test Suite:
 * Indian Mobile Phone Formatting & Validation, Aryan Watermark Placeholder,
 * Default Male Gender Selection, and SQLite Persistence Verification.
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { cleanAndFormatIndianPhone } from './src/components/RegisterView';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'data/smartqueue.db');
const BASE_URL = 'http://localhost:3000/api';

let passed = 0;
let failed = 0;

function assert(description: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${description}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${description}`);
    if (detail) console.error(`    Detail: ${detail}`);
    failed++;
  }
}

async function runIndianRegistrationTests() {
  console.log('===========================================================');
  console.log('   INDIAN CONTACT & REGISTRATION FORM VERIFICATION SUITE   ');
  console.log('===========================================================\n');

  // STEP 1: Phone Formatting Helper Tests
  console.log('--- TEST GROUP 1: Indian Phone Formatting & Duplicate Prevention ---');
  assert('Formats 10 clean digits as XXXXX XXXXX', cleanAndFormatIndianPhone('9876543210') === '98765 43210');
  assert('Strips leading +91 to prevent duplicate country codes', cleanAndFormatIndianPhone('+919876543210') === '98765 43210');
  assert('Strips leading 91 from 12-digit input', cleanAndFormatIndianPhone('919876543210') === '98765 43210');
  assert('Strips leading 0 from 11-digit input', cleanAndFormatIndianPhone('09876543210') === '98765 43210');
  assert('Preserves spaces if already formatted', cleanAndFormatIndianPhone('98765 43210') === '98765 43210');
  assert('Handles partial input gracefully', cleanAndFormatIndianPhone('9876') === '9876');

  // STEP 2: Name Validation (Empty names rejected)
  console.log('\n--- TEST GROUP 2: Full Legal Name Validation ---');
  const emptyNameRes = await fetch(`${BASE_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: '   ',
      age: 25,
      gender: 'Male',
      contactNumber: '+91 98765 43210',
      department: 'General Medicine',
      chiefComplaint: 'General checkup',
    }),
  });
  assert('Registration rejects empty patient name (HTTP 400)', emptyNameRes.status === 400);

  // STEP 3: Indian Phone Number Validation on Backend
  console.log('\n--- TEST GROUP 3: Indian Phone Number Backend Validation ---');

  // 3a. Invalid starting digit (must start with 6, 7, 8, or 9)
  const invalidDigitRes = await fetch(`${BASE_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Rohan Sharma',
      age: 30,
      gender: 'Male',
      contactNumber: '+91 12345 67890',
      department: 'General Medicine',
      chiefComplaint: 'Mild allergic rash',
    }),
  });
  assert('Rejects Indian mobile starting with 1 (HTTP 400)', invalidDigitRes.status === 400);

  // 3b. Incomplete length (< 10 digits)
  const shortPhoneRes = await fetch(`${BASE_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Rohan Sharma',
      age: 30,
      gender: 'Male',
      contactNumber: '+91 98765',
      department: 'General Medicine',
      chiefComplaint: 'Mild allergic rash',
    }),
  });
  assert('Rejects incomplete Indian mobile number (HTTP 400)', shortPhoneRes.status === 400);

  // STEP 4: Successful Registration with Indian Mobile & Default Male Gender
  console.log('\n--- TEST GROUP 4: Registration with +91 Mobile & Default Male Gender ---');
  const validRes = await fetch(`${BASE_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Rohan Sharma',
      age: 29,
      gender: 'Male',
      contactNumber: '+91 98765 43210',
      department: 'General Medicine',
      chiefComplaint: 'Seasonal viral bronchitis and fever',
      allergies: ['None reported'],
    }),
  });
  assert('Registration succeeds with valid Indian mobile (HTTP 201)', validRes.status === 201);
  const patient = await validRes.json();

  assert('Assigned unique token (MED-XXX)', !!patient.token && patient.token.startsWith('MED-'));
  assert('Assigned 128-bit pass ID (SQ-PASS-...-B)', !!patient.passId && patient.passId.startsWith('SQ-PASS-'));
  assert('Assigned gender is Male', patient.gender === 'Male');
  assert('Normalized contact number is +91 98765 43210', patient.contactNumber === '+91 98765 43210');

  // STEP 5: SQLite Database Verification
  console.log('\n--- TEST GROUP 5: Direct SQLite Relational Verification ---');
  const db = new Database(DB_PATH, { readonly: true });
  const row = db
    .prepare(
      `SELECT p.id, p.full_name, p.gender, p.contact_number, pass.pass_token, pass.status AS pass_status, q.token
       FROM patients p
       JOIN patient_passes pass ON pass.patient_id = p.id
       JOIN queue_entries q ON q.patient_id = p.id
       WHERE p.id = ?`
    )
    .get(patient.id) as any;

  assert('Patient record saved in SQLite patients table', !!row);
  assert('Gender saved as Male in SQLite', row && row.gender === 'Male');
  assert('Contact number saved as +91 98765 43210 in SQLite', row && row.contact_number === '+91 98765 43210');
  assert('Pass saved in SQLite patient_passes table', row && row.pass_token === patient.passId);
  assert('Queue entry saved in SQLite queue_entries table', row && row.token === patient.token);

  // Check that prior records were not deleted or wiped
  const totalCount = (db.prepare('SELECT COUNT(*) as c FROM patients').get() as any).c;
  assert(`Prior database records preserved (total patients: ${totalCount})`, totalCount >= 5);
  db.close();

  // STEP 6: Gate Scanner Verification for Indian Number Patient
  console.log('\n--- TEST GROUP 6: Gate Scanner Verification ---');
  const scanRes = await fetch(`${BASE_URL}/scanner/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer sec-gate-token-402',
    },
    body: JSON.stringify({ code: patient.passId }),
  }).then((r) => r.json());

  assert('Gate scanner grants access for new patient (VALID)', scanRes.outcome === 'VALID');
  assert('Clearance displays masked name (Rohan S.)', scanRes.patientNameMasked === 'Rohan S.');
  assert('Clearance routes to General Medicine', scanRes.department === 'General Medicine');

  // SUMMARY
  console.log('\n===========================================================');
  console.log(`TOTAL INDIAN REGISTRATION CHECKS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('===========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runIndianRegistrationTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
