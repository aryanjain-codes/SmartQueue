/**
 * SmartQueue Gate Scanner End-to-End Verification Test Suite
 * Validates the complete flow:
 * 1. Register new synthetic patient
 * 2. Generate unique 128-bit QR pass
 * 3. Optical QR scan decode using jsQR library
 * 4. Verify gate clearance via secure server endpoint
 * 5. Confirm privacy sanitization (no EHR or personal details exposed)
 * 6. Verify SQLite scan log persistence
 * 7. Validate duplicate scan detection & warnings
 * 8. Validate pass revocation outcome
 * 9. Validate invalid / unknown token handling
 */

import QRCode from 'qrcode';
import jsQR from 'jsqr';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const BASE_URL = 'http://localhost:3000/api';
const SECURITY_TOKEN = 'sec-gate-token-402';
const DB_PATH = path.join(__dirname, 'data', 'smartqueue.db');

async function runGateScannerSuite() {
  console.log('===========================================================');
  console.log('   SMARTQUEUE GATE SCANNER END-TO-END VERIFICATION SUITE   ');
  console.log('===========================================================');

  // STEP 1: Register New Synthetic Patient
  console.log('\n--- STEP 1: Synthetic Patient Registration ---');
  const regPayload = {
    fullName: 'Aditya Sharma',
    age: 34,
    gender: 'Male',
    contactNumber: '+91 98765 43210',
    department: 'General Medicine',
    chiefComplaint: 'Intermittent headaches and blurred vision',
    allergies: ['Penicillin', 'Sulfa'],
    mrn: 'MRN-GATE-TEST-01',
  };

  const regRes = await fetch(`${BASE_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(regPayload),
  });

  assert('Patient registration succeeds with HTTP 201', regRes.status === 201);
  const patient = await regRes.json();

  assert('Patient received unique Visit Token (MED-xxx)', !!patient?.token && patient.token.startsWith('MED-'));
  assert('Patient received 128-bit Pass ID (SQ-PASS-...-B)', !!patient?.passId && patient.passId.startsWith('SQ-PASS-'));
  console.log(`    Registered Patient: ${patient.fullName} | Token: ${patient.token} | Pass: ${patient.passId}`);

  // STEP 2: Generate Real QR Code for Pass
  console.log('\n--- STEP 2: ISO-18004 QR Code Generation ---');
  const passToken = patient.passId;
  const qrMatrix = QRCode.create(passToken, { errorCorrectionLevel: 'M' });

  assert('QR Matrix created with valid module size', qrMatrix.modules.size > 0);
  console.log(`    QR Matrix dimensions: ${qrMatrix.modules.size}x${qrMatrix.modules.size} modules`);

  // STEP 3: Optical Decoding via jsQR Library
  console.log('\n--- STEP 3: Optical QR Decoding with jsQR ---');
  // Render modules into an RGBA buffer (simulating webcam frame rasterization)
  const moduleSize = qrMatrix.modules.size;
  const scale = 4;
  const width = moduleSize * scale;
  const height = moduleSize * scale;
  const rgbaBuffer = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const modX = Math.floor(x / scale);
      const modY = Math.floor(y / scale);
      const isDark = qrMatrix.modules.get(modX, modY);
      const idx = (y * width + x) * 4;
      const pixelVal = isDark ? 0 : 255;
      rgbaBuffer[idx] = pixelVal;
      rgbaBuffer[idx + 1] = pixelVal;
      rgbaBuffer[idx + 2] = pixelVal;
      rgbaBuffer[idx + 3] = 255;
    }
  }

  const opticalScanResult = jsQR(rgbaBuffer, width, height, { inversionAttempts: 'attemptBoth' });
  assert('jsQR optical frame decoding returns non-null result', opticalScanResult !== null);
  assert(
    'jsQR decoded payload matches original opaque pass ID exactly',
    opticalScanResult?.data === passToken,
    `Decoded: ${opticalScanResult?.data} vs Expected: ${passToken}`
  );
  console.log(`    Decoded Optical QR Payload: "${opticalScanResult?.data}"`);

  // STEP 4: Server Gate Clearance Verification
  console.log('\n--- STEP 4: Server Gate Clearance Verification ---');
  const scannedCode = opticalScanResult?.data || passToken;
  const verifyRes = await fetch(`${BASE_URL}/scanner/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SECURITY_TOKEN}`,
    },
    body: JSON.stringify({ code: scannedCode, gateId: 'Gate 02' }),
  });

  assert('Authenticated scanner verification returns HTTP 200', verifyRes.status === 200);
  const clearance = await verifyRes.json();

  assert('Clearance outcome is VALID for active pass', clearance.outcome === 'VALID', `Got: ${clearance.outcome}`);
  assert('Clearance includes masked patient name ("Aditya S.")', clearance.patientNameMasked === 'Aditya S.', `Got: ${clearance.patientNameMasked}`);
  assert('Clearance routes to designated clinic (General Medicine, Room 104)', clearance.department === 'General Medicine' && clearance.room === 'Room 104');
  assert('Clearance includes matching patient token', clearance.token === patient.token);
  assert('First scan is NOT flagged as duplicate', clearance.isDuplicateScan === false);

  // STEP 5: Gate Privacy Scrubbing Check
  console.log('\n--- STEP 5: Security / Gate Least-Privilege Privacy Enforcement ---');
  assert('Gate clearance strictly omits chiefComplaint', clearance.chiefComplaint === undefined);
  assert('Gate clearance strictly omits allergies', clearance.allergies === undefined);
  assert('Gate clearance strictly omits contactNumber', clearance.contactNumber === undefined);
  assert('Gate clearance strictly omits full legal name', clearance.fullName === undefined);
  assert('Gate clearance strictly omits raw MRN', clearance.mrn === undefined);

  // STEP 6: SQLite Scan Log Relational Persistence
  console.log('\n--- STEP 6: SQLite Database Scan Log Relational Check ---');
  const db = new Database(DB_PATH, { readonly: true });
  const recentLog = db
    .prepare(
      `SELECT * FROM gate_scan_logs WHERE pass_token = ? ORDER BY timestamp DESC LIMIT 1`
    )
    .get(passToken) as any;

  assert('Scan event persisted in SQLite gate_scan_logs table', recentLog !== undefined);
  assert('SQLite log records outcome as VALID', recentLog?.outcome === 'VALID');
  assert('SQLite log records security operator SEC-402', recentLog?.operator_id === 'SEC-402');
  assert('SQLite log records terminal Gate 02', recentLog?.gate_id === 'Gate 02');
  assert('SQLite log records is_duplicate = 0', recentLog?.is_duplicate === 0);

  // STEP 7: Duplicate Scan Detection within 5-Minute Window
  console.log('\n--- STEP 7: Duplicate Scan Detection ---');
  const dupRes = await fetch(`${BASE_URL}/scanner/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SECURITY_TOKEN}`,
    },
    body: JSON.stringify({ code: scannedCode, gateId: 'Gate 02' }),
  });

  assert('Duplicate scan request returns HTTP 200', dupRes.status === 200);
  const dupClearance = await dupRes.json();
  assert('Second scan flagged as duplicate (isDuplicateScan: true)', dupClearance.isDuplicateScan === true);
  assert('Duplicate warning message provided', typeof dupClearance.duplicateWarning === 'string');

  const dupLog = db
    .prepare(
      `SELECT * FROM gate_scan_logs WHERE pass_token = ? ORDER BY timestamp DESC LIMIT 1`
    )
    .get(passToken) as any;
  assert('Second scan recorded as duplicate in SQLite (is_duplicate = 1)', dupLog?.is_duplicate === 1);

  // STEP 8: Pass Revocation Outcome
  console.log('\n--- STEP 8: Pass Revocation & Denied Clearance ---');
  const revokeRes = await fetch(`${BASE_URL}/scanner/pass-status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SECURITY_TOKEN}`,
    },
    body: JSON.stringify({ code: passToken, status: 'revoked' }),
  });
  assert('Pass revocation responds HTTP 200', revokeRes.status === 200);

  const revokedScanRes = await fetch(`${BASE_URL}/scanner/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SECURITY_TOKEN}`,
    },
    body: JSON.stringify({ code: passToken, gateId: 'Gate 02' }),
  });
  const revokedClearance = await revokedScanRes.json();
  assert('Revoked pass returns outcome REVOKED', revokedClearance.outcome === 'REVOKED');

  // STEP 9: Expired Pass Test Fixture
  console.log('\n--- STEP 9: Expired Pass Outcome ---');
  const expScanRes = await fetch(`${BASE_URL}/scanner/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SECURITY_TOKEN}`,
    },
    body: JSON.stringify({ code: 'SQ-PASS-EXPIRED-TEST-FIXTURE-B', gateId: 'Gate 02' }),
  });
  const expClearance = await expScanRes.json();
  assert('Expired test fixture returns outcome EXPIRED', expClearance.outcome === 'EXPIRED');

  // STEP 10: Unknown / Invalid QR Code
  console.log('\n--- STEP 10: Invalid QR / Unrecognized Signature ---');
  const invalidScanRes = await fetch(`${BASE_URL}/scanner/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SECURITY_TOKEN}`,
    },
    body: JSON.stringify({ code: 'SQ-UNKNOWN-RANDOM-BARCODE-999', gateId: 'Gate 02' }),
  });
  const invalidClearance = await invalidScanRes.json();
  assert('Unknown QR returns outcome INVALID', invalidClearance.outcome === 'INVALID');

  db.close();

  console.log('\n===========================================================');
  console.log(`TOTAL GATE SCANNER CHECKS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('===========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runGateScannerSuite().catch((err) => {
  console.error('Fatal error in gate scanner test suite:', err);
  process.exit(1);
});
