/**
 * SmartQueue Automated Regression Test Suite:
 * Multi-Patient Registration, Distinct Pass Generation, QR Verification,
 * Pass Expiry/Revocation, and Server Restart Persistence.
 */

import { queueDb } from './server/queueStore';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'data/smartqueue.json');
const SCANS_FILE = path.join(__dirname, 'data/gate_scans.json');

const BASE_URL = 'http://localhost:3000/api';
const SECURITY_TOKEN = process.env.SECURITY_AUTH_TOKEN || 'sec-gate-token-402';

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

async function runRegressionSuite() {
  console.log('===========================================================');
  console.log('  MULTI-PATIENT PASS REGISTRATION & QR REGRESSION SUITE    ');
  console.log('===========================================================');

  // Clear demo database and reset rate limits for a clean regression run
  await fetch(`${BASE_URL}/reset-demo`, { method: 'POST' }).catch(() => {});

  // STEP 1: Register 3 Distinct Patients across different departments
  console.log('\n--- TEST GROUP 1: Register 3 Distinct Patients ---');

  const p1Payload = {
    fullName: 'Alice Cooper',
    age: 31,
    gender: 'Female',
    contactNumber: '(555) 111-2233',
    department: 'General Medicine',
    chiefComplaint: 'Acute throbbing migraine and light sensitivity',
    allergies: ['Penicillin'],
  };

  const p2Payload = {
    fullName: 'Bob Vance',
    age: 66,
    gender: 'Male',
    contactNumber: '(555) 444-5566',
    department: 'Cardiology',
    chiefComplaint: 'Chest tightness and rapid palpitations upon exertion',
    allergies: ['Aspirin'],
  };

  const p3Payload = {
    fullName: 'Carol Danvers',
    age: 29,
    gender: 'Female',
    contactNumber: '(555) 777-8899',
    department: 'Orthopaedics',
    chiefComplaint: 'Severe left wrist sprain after athletic fall',
    allergies: ['None reported'],
  };

  const res1 = await fetch(`${BASE_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(p1Payload),
  });
  assert('Patient 1 (Alice Cooper) registered successfully (HTTP 201)', res1.status === 201);
  const p1 = await res1.json();

  const res2 = await fetch(`${BASE_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(p2Payload),
  });
  assert('Patient 2 (Bob Vance) registered successfully (HTTP 201)', res2.status === 201);
  const p2 = await res2.json();

  const res3 = await fetch(`${BASE_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(p3Payload),
  });
  assert('Patient 3 (Carol Danvers) registered successfully (HTTP 201)', res3.status === 201);
  const p3 = await res3.json();

  // STEP 2: Verify Unique Identifiers and Tokens
  console.log('\n--- TEST GROUP 2: Uniqueness of IDs, Tokens & Pass Identifiers ---');
  assert('Patient 1 has unique token prefix MED', p1.token.startsWith('MED-'), p1.token);
  assert('Patient 2 has unique token prefix CARD', p2.token.startsWith('CARD-'), p2.token);
  assert('Patient 3 has unique token prefix ORTH', p3.token.startsWith('ORTH-'), p3.token);

  assert('All 3 tokens are distinct', p1.token !== p2.token && p2.token !== p3.token && p1.token !== p3.token);
  assert('All 3 Patient IDs are distinct', p1.id !== p2.id && p2.id !== p3.id && p1.id !== p3.id);
  assert('All 3 Pass IDs are distinct', p1.passId !== p2.passId && p2.passId !== p3.passId && p1.passId !== p3.passId);

  assert('Patient 1 passId is 128-bit format SQ-PASS-...-B', /^SQ-PASS-[A-F0-9]{32}-B$/.test(p1.passId), p1.passId);
  assert('Patient 2 passId is 128-bit format SQ-PASS-...-B', /^SQ-PASS-[A-F0-9]{32}-B$/.test(p2.passId), p2.passId);
  assert('Patient 3 passId is 128-bit format SQ-PASS-...-B', /^SQ-PASS-[A-F0-9]{32}-B$/.test(p3.passId), p3.passId);

  // Assert Pass IDs do NOT contain medical data
  assert('Pass ID does not contain medical complaint', !p1.passId.toLowerCase().includes('migraine'));
  assert('Pass ID does not contain phone number', !p1.passId.includes('111'));

  // STEP 3: Retrieve Pass by Token, Patient ID, and Pass ID
  console.log('\n--- TEST GROUP 3: Patient Self-Lookup & Retrieval ---');

  const l1 = await fetch(`${BASE_URL}/token/${p1.token}`).then((r) => r.json());
  assert('Lookup Patient 1 by token returns correct passId', l1.passId === p1.passId);
  assert('Lookup Patient 1 by token returns full legal name', l1.fullName === 'Alice Cooper');

  const l2 = await fetch(`${BASE_URL}/token/${p2.passId}`).then((r) => r.json());
  assert('Lookup Patient 2 by passId returns correct token', l2.token === p2.token);
  assert('Lookup Patient 2 by passId returns Cardiology clinic', l2.department === 'Cardiology');

  const l3 = await fetch(`${BASE_URL}/token/${p3.id}`).then((r) => r.json());
  assert('Lookup Patient 3 by patient ID returns correct token and pass', l3.token === p3.token && l3.passId === p3.passId);

  // STEP 4: Real QR Generation
  console.log('\n--- TEST GROUP 4: QR Code Generation for Distinct Patients ---');

  const qr1 = await QRCode.toDataURL(p1.passId);
  assert('Patient 1 QR generated as valid data URL', qr1.startsWith('data:image/png;base64,'));

  const qr2 = await QRCode.toDataURL(p2.passId);
  assert('Patient 2 QR generated as valid data URL', qr2.startsWith('data:image/png;base64,'));

  const qr3 = await QRCode.toDataURL(p3.passId);
  assert('Patient 3 QR generated as valid data URL', qr3.startsWith('data:image/png;base64,'));
  assert('All 3 QR codes are non-identical image blobs', qr1 !== qr2 && qr2 !== qr3);

  // STEP 5: Gate Scanner Verification for All 3 Patients
  console.log('\n--- TEST GROUP 5: Gate Scanner Clearance for Distinct Patients ---');

  const v1 = await fetch(`${BASE_URL}/scanner/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SECURITY_TOKEN}`,
    },
    body: JSON.stringify({ code: p1.passId, gateId: 'Gate 02' }),
  }).then((r) => r.json());

  assert('Patient 1 gate clearance is VALID', v1.outcome === 'VALID');
  assert('Patient 1 clearance returns masked name (Alice C.)', v1.patientNameMasked === 'Alice C.', v1.patientNameMasked);
  assert('Patient 1 clearance designates General Medicine (Room 104)', v1.room === 'Room 104');
  assert('Patient 1 clearance strictly excludes contactNumber and chiefComplaint', v1.contactNumber === undefined && v1.chiefComplaint === undefined);

  const v2 = await fetch(`${BASE_URL}/scanner/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SECURITY_TOKEN}`,
    },
    body: JSON.stringify({ code: p2.passId, gateId: 'Gate 01' }),
  }).then((r) => r.json());

  assert('Patient 2 gate clearance is VALID', v2.outcome === 'VALID');
  assert('Patient 2 clearance returns masked name (Bob V.)', v2.patientNameMasked === 'Bob V.', v2.patientNameMasked);
  assert('Patient 2 clearance designates Cardiology (Room 102)', v2.room === 'Room 102');

  const v3 = await fetch(`${BASE_URL}/scanner/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SECURITY_TOKEN}`,
    },
    body: JSON.stringify({ code: p3.passId, gateId: 'Gate 03' }),
  }).then((r) => r.json());

  assert('Patient 3 gate clearance is VALID', v3.outcome === 'VALID');
  assert('Patient 3 clearance returns masked name (Carol D.)', v3.patientNameMasked === 'Carol D.', v3.patientNameMasked);
  assert('Patient 3 clearance designates Orthopaedics (Room 105)', v3.room === 'Room 105');

  // STEP 6: Reject Invalid, Expired, and Revoked Passes for Specific Patients
  console.log('\n--- TEST GROUP 6: Pass Status Modification & Rejection ---');

  // 1. Update Patient 2 pass to revoked
  const revokeRes = await fetch(`${BASE_URL}/scanner/pass-status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SECURITY_TOKEN}`,
    },
    body: JSON.stringify({ code: p2.passId, status: 'revoked' }),
  }).then((r) => r.json());
  assert('Server updated Patient 2 pass to revoked', revokeRes.success === true);

  const v2Revoked = await fetch(`${BASE_URL}/scanner/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SECURITY_TOKEN}`,
    },
    body: JSON.stringify({ code: p2.passId }),
  }).then((r) => r.json());
  assert('Gate scanner rejects Patient 2 with REVOKED outcome', v2Revoked.outcome === 'REVOKED');
  assert('Revoked response includes security hold warning', v2Revoked.message.includes('revoked'));

  // 2. Update Patient 3 pass to expired
  const expireRes = await fetch(`${BASE_URL}/scanner/pass-status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SECURITY_TOKEN}`,
    },
    body: JSON.stringify({ code: p3.passId, status: 'expired' }),
  }).then((r) => r.json());
  assert('Server updated Patient 3 pass to expired', expireRes.success === true);

  const v3Expired = await fetch(`${BASE_URL}/scanner/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SECURITY_TOKEN}`,
    },
    body: JSON.stringify({ code: p3.passId }),
  }).then((r) => r.json());
  assert('Gate scanner rejects Patient 3 with EXPIRED outcome', v3Expired.outcome === 'EXPIRED');

  // 3. Reject unknown / forged code
  const vUnknown = await fetch(`${BASE_URL}/scanner/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SECURITY_TOKEN}`,
    },
    body: JSON.stringify({ code: 'SQ-UNKNOWN-FORGED-TOKEN-999' }),
  }).then((r) => r.json());
  assert('Gate scanner rejects forged code with INVALID outcome', vUnknown.outcome === 'INVALID');

  // STEP 7: Confirm Server Restart Persistence
  console.log('\n--- TEST GROUP 7: Persistence Across Server Restarts ---');

  // Read smartqueue.json directly from disk
  assert('smartqueue.json exists on disk', fs.existsSync(DATA_FILE));
  const diskData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  assert('Disk file contains array of patient records', Array.isArray(diskData) && diskData.length >= 3);

  const diskP1 = diskData.find((p: any) => p.token === p1.token);
  assert('Patient 1 persisted on disk with active status', diskP1 && diskP1.passStatus === 'active' && diskP1.fullName === 'Alice Cooper');

  const diskP2 = diskData.find((p: any) => p.token === p2.token);
  assert('Patient 2 persisted on disk with revoked status', diskP2 && diskP2.passStatus === 'revoked' && diskP2.fullName === 'Bob Vance');

  const diskP3 = diskData.find((p: any) => p.token === p3.token);
  assert('Patient 3 persisted on disk with expired status', diskP3 && diskP3.passStatus === 'expired' && diskP3.fullName === 'Carol Danvers');

  // Check scan audit log persistence
  assert('gate_scans.json exists on disk', fs.existsSync(SCANS_FILE));
  const diskScans = JSON.parse(fs.readFileSync(SCANS_FILE, 'utf-8'));
  assert('Scan logs persisted to disk (at least 3 scans recorded)', Array.isArray(diskScans) && diskScans.length >= 3);

  console.log('\n===========================================================');
  console.log(`TOTAL REGRESSION CHECKS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('===========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runRegressionSuite().catch((err) => {
  console.error('Regression suite failed with uncaught exception:', err);
  process.exit(1);
});
