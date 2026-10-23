/**
 * SmartQueue Staff Authentication & Notes Persistence Test Suite
 *
 * Verifies:
 * 1. POST /api/staff/login with Clinical credentials returns signed HMAC token
 * 2. POST /api/staff/login with Security credentials returns signed HMAC token
 * 3. Invalid credentials rejected with 401 Unauthorized
 * 4. Missing credentials rejected with 400 Bad Request
 * 5. GET /api/staff/session validates active session
 * 6. RBAC: Clinical session can access /api/staff/queue
 * 7. RBAC: Security session is blocked from /api/staff/queue with 403 Forbidden
 * 8. PATCH /api/staff/patient/:query/notes updates notes in SQLite
 * 9. Direct SQLite inspection confirms note persisted to disk
 * 10. POST /api/staff/logout revokes session token (subsequent calls return 401)
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  validateProductionAuthConfig,
  authenticateCredentials,
  getSessionSecret,
  authenticateStaff,
  SECURITY_AUTH_TOKEN,
  CLINICAL_AUTH_TOKEN,
} from './server/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'data/smartqueue.db');
const BASE = 'http://localhost:3000/api';

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

export async function runStaffAuthTests() {
  console.log('===========================================================');
  console.log('   SMARTQUEUE STAFF AUTH & PERSISTENCE TEST SUITE          ');
  console.log('===========================================================\n');

  // TEST GROUP 1: Staff Login Endpoint
  console.log('--- TEST GROUP 1: Staff Authentication & Credentials ---');

  // 1. Missing credentials
  const badReqRes = await fetch(`${BASE}/staff/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert('Missing credentials rejected with 400 Bad Request', badReqRes.status === 400);

  // 2. Invalid password
  const badPassRes = await fetch(`${BASE}/staff/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'dr.jenkins', password: 'WrongPassword123!' }),
  });
  assert('Invalid password rejected with 401 Unauthorized', badPassRes.status === 401);

  // 3. Valid Clinical Doctor login
  const docLoginRes = await fetch(`${BASE}/staff/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'dr.jenkins', password: 'ClinicalDoc#2026' }),
  });
  assert('Clinical Doctor login succeeds with 200 OK', docLoginRes.status === 200);
  const docData = await docLoginRes.json();
  assert('Returns signed HMAC session token', !!docData.token && docData.token.includes('.'));
  assert('Returns clinical role', docData.user?.role === 'clinical');
  assert('Returns Dr. Sarah Jenkins profile', docData.user?.name === 'Dr. Sarah Jenkins, MD');
  const clinicalToken = docData.token;

  // 4. Valid Gate Security login
  const secLoginRes = await fetch(`${BASE}/staff/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'officer.briggs', password: 'GateSecurity#2026' }),
  });
  assert('Gate Security login succeeds with 200 OK', secLoginRes.status === 200);
  const secData = await secLoginRes.json();
  assert('Returns signed HMAC session token for security', !!secData.token && secData.token.includes('.'));
  assert('Returns security role', secData.user?.role === 'security');
  assert('Returns Officer T. Briggs profile', docData.user?.operatorId === 'CLN-104' && secData.user?.operatorId === 'SEC-402');
  const securityToken = secData.token;

  // TEST GROUP 2: Session Verification & RBAC Enforcement
  console.log('\n--- TEST GROUP 2: Session Verification & Role-Based Access Control ---');

  // 5. GET /api/staff/session with valid token
  const sessionRes = await fetch(`${BASE}/staff/session`, {
    headers: { Authorization: `Bearer ${clinicalToken}` },
  });
  assert('GET /api/staff/session validates active clinical session', sessionRes.status === 200);
  const sessionData = await sessionRes.json();
  assert('Session response reports authenticated: true', sessionData.authenticated === true);

  // 6. Clinical session accessing protected clinical EHR queue
  const clinQueueRes = await fetch(`${BASE}/staff/queue`, {
    headers: { Authorization: `Bearer ${clinicalToken}` },
  });
  assert('Clinical session accesses /api/staff/queue (200 OK)', clinQueueRes.status === 200);
  const clinQueueData = await clinQueueRes.json();
  assert('Clinical state includes protected clinical EHR patient records', Array.isArray(clinQueueData.patients) && clinQueueData.patients.length > 0);

  // 7. Security session blocked from accessing clinical EHR queue
  const secBlockRes = await fetch(`${BASE}/staff/queue`, {
    headers: { Authorization: `Bearer ${securityToken}` },
  });
  assert('Security session blocked from /api/staff/queue with 403 Forbidden', secBlockRes.status === 403);

  // TEST GROUP 3: Consultation Notes Persistence in SQLite
  console.log('\n--- TEST GROUP 3: Clinical Notes SQLite Persistence ---');

  const testNote = `Verified consultation at ${new Date().toISOString()}. Patient recommended for routine follow-up.`;
  const noteRes = await fetch(`${BASE}/staff/patient/MED-042/notes`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clinicalToken}`,
    },
    body: JSON.stringify({ notes: testNote }),
  });
  assert('PATCH /api/staff/patient/MED-042/notes succeeds (200 OK)', noteRes.status === 200);
  const noteData = await noteRes.json();
  assert('API response reflects updated notes', noteData.patient?.notes === testNote);

  // Verify directly from SQLite database file on disk
  const db = new Database(DB_PATH, { readonly: true });
  const row = db
    .prepare(
      `SELECT p.notes FROM patients p JOIN queue_entries q ON q.patient_id = p.id WHERE q.token = 'MED-042'`
    )
    .get() as { notes: string } | undefined;
  db.close();

  assert('Consultation notes persisted directly to SQLite patients table', row?.notes === testNote);

  // Security role blocked from updating notes
  const secNoteRes = await fetch(`${BASE}/staff/patient/MED-042/notes`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${securityToken}`,
    },
    body: JSON.stringify({ notes: 'Unauthorized attempt' }),
  });
  assert('Security credentials blocked from updating notes (403 Forbidden)', secNoteRes.status === 403);

  // TEST GROUP 4: Logout & Session Invalidation
  console.log('\n--- TEST GROUP 4: Logout & Session Revocation ---');

  const logoutRes = await fetch(`${BASE}/staff/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${clinicalToken}` },
  });
  assert('POST /api/staff/logout succeeds (200 OK)', logoutRes.status === 200);

  // Subsequent call with revoked token must return 401
  const afterLogoutRes = await fetch(`${BASE}/staff/session`, {
    headers: { Authorization: `Bearer ${clinicalToken}` },
  });
  assert('Revoked session token returns 401 Unauthorized after logout', afterLogoutRes.status === 401);

  // TEST GROUP 5: Production Security Lockdown & Machine Bearer Token Isolation
  console.log('\n--- TEST GROUP 5: Production Lockdown & Machine Token Protection ---');

  const origEnv = { ...process.env };

  try {
    // 5.1 Simulate Production with missing credentials
    process.env.NODE_ENV = 'production';
    delete process.env.STAFF_SESSION_SECRET;
    delete process.env.SESSION_SECRET;
    delete process.env.STAFF_CLINICAL_PASSWORD;
    delete process.env.STAFF_SECURITY_PASSWORD;

    const prodCheckFail = validateProductionAuthConfig();
    assert(
      'Missing production credentials rejected by validateProductionAuthConfig()',
      prodCheckFail.valid === false && prodCheckFail.errors.length === 3
    );
    assert(
      'Production error identifies missing session secret',
      prodCheckFail.errors.some((e) => e.includes('STAFF_SESSION_SECRET'))
    );
    assert(
      'Production error identifies missing clinical password',
      prodCheckFail.errors.some((e) => e.includes('STAFF_CLINICAL_PASSWORD'))
    );
    assert(
      'Production error identifies missing security password',
      prodCheckFail.errors.some((e) => e.includes('STAFF_SECURITY_PASSWORD'))
    );

    // 5.2 Validate safe fallback prevention in production
    assert(
      'getSessionSecret() returns empty string in production when unconfigured',
      getSessionSecret() === ''
    );
    assert(
      'authenticateCredentials() rejects default passwords in production when unconfigured',
      authenticateCredentials('dr.jenkins', 'ClinicalDoc#2026') === null &&
      authenticateCredentials('officer.briggs', 'GateSecurity#2026') === null
    );

    // 5.3 Test machine bearer tokens are completely disabled in production
    const mockSecReq = { headers: { authorization: `Bearer ${SECURITY_AUTH_TOKEN}` } };
    const prodSecAuth = authenticateStaff(mockSecReq);
    assert(
      'SECURITY_AUTH_TOKEN machine bearer token strictly returns role: public in production',
      prodSecAuth.role === 'public'
    );

    const mockClnReq = { headers: { authorization: `Bearer ${CLINICAL_AUTH_TOKEN}` } };
    const prodClnAuth = authenticateStaff(mockClnReq);
    assert(
      'CLINICAL_AUTH_TOKEN machine bearer token strictly returns role: public in production',
      prodClnAuth.role === 'public'
    );

    const mockXStaffReq = { headers: { 'x-staff-token': SECURITY_AUTH_TOKEN } };
    const prodXStaffAuth = authenticateStaff(mockXStaffReq);
    assert(
      'x-staff-token machine header strictly returns role: public in production',
      prodXStaffAuth.role === 'public'
    );

    // 5.4 Test short secret or password fails production validation
    process.env.STAFF_SESSION_SECRET = 'short';
    process.env.STAFF_CLINICAL_PASSWORD = '123';
    process.env.STAFF_SECURITY_PASSWORD = 'abc';
    const shortCheck = validateProductionAuthConfig();
    assert(
      'Short secret (<16 chars) and passwords (<8 chars) fail production validation',
      shortCheck.valid === false && shortCheck.errors.length === 3
    );

    // 5.5 Test valid production configuration passes
    process.env.STAFF_SESSION_SECRET = 'prod-secret-must-be-at-least-16-characters-long';
    process.env.STAFF_CLINICAL_PASSWORD = 'ProdClinicalSecure#2026';
    process.env.STAFF_SECURITY_PASSWORD = 'ProdSecuritySecure#2026';
    const validProdCheck = validateProductionAuthConfig();
    assert(
      'Properly configured production credentials pass validateProductionAuthConfig()',
      validProdCheck.valid === true && validProdCheck.errors.length === 0
    );

    // In production with valid credentials set, authenticateCredentials works for those credentials
    const validProdLogin = authenticateCredentials('dr.jenkins', 'ProdClinicalSecure#2026');
    assert(
      'Clinical login succeeds with configured production password',
      validProdLogin !== null && validProdLogin.role === 'clinical'
    );
  } finally {
    // Restore original environment
    for (const key of Object.keys(process.env)) {
      if (!(key in origEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, origEnv);
  }

  // 5.6 Non-production machine token assertion (for automated test environments)
  const devSecReq = { headers: { authorization: `Bearer ${SECURITY_AUTH_TOKEN}` } };
  const devSecAuth = authenticateStaff(devSecReq);
  assert(
    'In development/testing (NODE_ENV !== production), machine bearer token resolves to role: security',
    devSecAuth.role === 'security'
  );

  console.log('\n===========================================================');
  console.log(`TOTAL STAFF AUTH & PERSISTENCE CHECKS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('===========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

// Run standalone if invoked directly
runStaffAuthTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
