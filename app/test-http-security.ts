async function runHttpSecurityTests() {
  console.log('===========================================================');
  console.log('   SMARTQUEUE HTTP REST ENDPOINTS SECURITY TEST SUITE       ');
  console.log('===========================================================\n');

  const BASE = 'http://localhost:3000/api';
  const SEC_TOKEN = 'sec-gate-token-402';
  const CLN_TOKEN = 'cln-med-token-104';

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${name} ${detail ? '-> ' + detail : ''}`);
      failed++;
    }
  }

  // 0. Reset demo baseline to ensure clean test state and clear rate-limit windows
  await fetch(`${BASE}/reset-demo`, { method: 'POST' }).catch(() => {});

  // 1. Health check
  const healthRes = await fetch(`${BASE}/health`);
  assert(healthRes.status === 200, 'Health endpoint responds 200 OK');

  // 2. Public Queue Privacy
  const pubRes = await fetch(`${BASE}/queue`);
  assert(pubRes.status === 200, 'Public GET /api/queue responds 200 OK');
  const pubData = await pubRes.json();
  const firstPatient = pubData.patients?.[0];
  assert(
    firstPatient &&
      !('chiefComplaint' in firstPatient) &&
      !('allergies' in firstPatient) &&
      !('contactNumber' in firstPatient) &&
      !('notes' in firstPatient),
    'Public GET /api/queue patient objects strictly omit chiefComplaint, allergies, contactNumber, and notes'
  );

  // 3. Patient self-lookup
  const lookupRes = await fetch(`${BASE}/token/MED-042`);
  assert(lookupRes.status === 200, 'Patient self-lookup GET /api/token/MED-042 responds 200');
  const lookupData = await lookupRes.json();
  assert(lookupData.token === 'MED-042', 'Patient self-lookup returned correct ticket for MED-042');

  // 4. Gate Scanner: Unauthenticated request rejected (Priority 1 & 3)
  const unauthScanRes = await fetch(`${BASE}/scanner/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: lookupData.passId }),
  });
  assert(
    unauthScanRes.status === 401,
    `Unauthenticated POST /api/scanner/verify rejected with 401 Unauthorized (got ${unauthScanRes.status})`
  );

  // 5. Gate Scanner: Authenticated as Security Staff (Priority 3)
  const authScanRes = await fetch(`${BASE}/scanner/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SEC_TOKEN}`,
    },
    body: JSON.stringify({ code: lookupData.passId }),
  });
  assert(authScanRes.status === 200, 'Authenticated POST /api/scanner/verify with Security token succeeds (200 OK)');
  const clearanceData = await authScanRes.json();
  assert(clearanceData.outcome === 'VALID', `Clearance outcome is VALID for active pass (${clearanceData.outcome})`);
  assert(
    !('contactNumber' in clearanceData) &&
      !('mrn' in clearanceData) &&
      !('chiefComplaint' in clearanceData) &&
      !('allergies' in clearanceData) &&
      !('notes' in clearanceData),
    'Gate clearance response excludes contactNumber, MRN, chiefComplaint, allergies, and clinical notes'
  );
  assert(
    clearanceData.patientNameMasked && clearanceData.patientNameMasked.endsWith('.'),
    `Patient name in gate clearance response is masked ("${clearanceData.patientNameMasked}")`
  );

  // 6. Expired Pass via HTTP API
  const expRes = await fetch(`${BASE}/scanner/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SEC_TOKEN}`,
    },
    body: JSON.stringify({ code: 'SQ-PASS-EXPIRED-TEST-FIXTURE-B' }),
  });
  const expData = await expRes.json();
  assert(expData.outcome === 'EXPIRED', `Expired pass returns outcome EXPIRED (got ${expData.outcome})`);

  // 7. Revoked Pass via HTTP API
  const revRes = await fetch(`${BASE}/scanner/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SEC_TOKEN}`,
    },
    body: JSON.stringify({ code: 'SQ-PASS-REVOKED-TEST-FIXTURE-B' }),
  });
  const revData = await revRes.json();
  assert(revData.outcome === 'REVOKED', `Revoked pass returns outcome REVOKED (got ${revData.outcome})`);

  // 8. Unknown / Invalid Pass via HTTP API
  const invRes = await fetch(`${BASE}/scanner/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SEC_TOKEN}`,
    },
    body: JSON.stringify({ code: 'UNKNOWN-TOKEN-1234' }),
  });
  const invData = await invRes.json();
  assert(invData.outcome === 'INVALID', `Unknown code returns outcome INVALID (got ${invData.outcome})`);

  // 9. Safe Duplicate Scan Detection via HTTP API
  const dupRes = await fetch(`${BASE}/scanner/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SEC_TOKEN}`,
    },
    body: JSON.stringify({ code: lookupData.passId }),
  });
  const dupData = await dupRes.json();
  assert(
    dupData.isDuplicateScan === true,
    `Immediate repeat scan of same pass flagged with isDuplicateScan: true`
  );
  assert(
    dupData.duplicateWarning && dupData.duplicateWarning.includes('Duplicate scan detected'),
    `Duplicate scan returns explicit warning message`
  );

  // 10. Clinical Role Separation: Security staff CANNOT access protected clinical queue
  const secClinRes = await fetch(`${BASE}/staff/queue`, {
    headers: { Authorization: `Bearer ${SEC_TOKEN}` },
  });
  assert(
    secClinRes.status === 403,
    `Security staff accessing GET /api/staff/queue rejected with 403 Forbidden (got ${secClinRes.status})`
  );

  // 11. Clinical Staff CAN access protected clinical queue
  const docClinRes = await fetch(`${BASE}/staff/queue`, {
    headers: { Authorization: `Bearer ${CLN_TOKEN}` },
  });
  assert(
    docClinRes.status === 200,
    `Clinical physician accessing GET /api/staff/queue receives 200 OK`
  );
  const docClinData = await docClinRes.json();
  assert(
    docClinData.patients?.[0]?.chiefComplaint !== undefined,
    'Clinical queue endpoint includes protected EHR chiefComplaint for doctor workstation'
  );

  // 12. Clinical staff can perform Call Next & Complete Consultation
  const callNextRes = await fetch(`${BASE}/staff/call-next`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CLN_TOKEN}`,
    },
    body: JSON.stringify({ department: 'General Medicine' }),
  });
  assert(callNextRes.status === 200, 'Clinical staff POST /api/staff/call-next succeeds (200 OK)');

  // 13. Rate Limiting verification
  console.log('\n--- Testing Scanner Rate Limiter ---');
  let hitRateLimit = false;
  for (let i = 0; i < 35; i++) {
    const res = await fetch(`${BASE}/scanner/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SEC_TOKEN}`,
      },
      body: JSON.stringify({ code: lookupData.passId }),
    });
    if (res.status === 429) {
      hitRateLimit = true;
      break;
    }
  }
  assert(hitRateLimit, 'Scanner rate limiter active: returns 429 Too Many Requests when threshold exceeded');

  // Reset rate limit map after threshold test so subsequent test suites are not blocked
  await fetch(`${BASE}/reset-demo`, { method: 'POST' }).catch(() => {});

  console.log('\n===========================================================');
  console.log(`HTTP TESTS EXECUTED: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('===========================================================');

  if (failed > 0) process.exit(1);
}

runHttpSecurityTests().catch((err) => {
  console.error('HTTP test failure:', err);
  process.exit(1);
});
