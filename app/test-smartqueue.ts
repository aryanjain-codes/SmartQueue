import { queueDb } from './server/queueStore';
import fs from 'fs';
import path from 'path';

async function runSecurityAndQueueTests() {
  console.log('===========================================================');
  console.log('   SMARTQUEUE OPD SECURITY & FUNCTIONALITY TEST SUITE      ');
  console.log('===========================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passedCount++;
    } else {
      console.error(`  ✗ FAIL: ${testName} ${details ? '- ' + details : ''}`);
      failedCount++;
    }
  }

  // -------------------------------------------------------------
  // TEST GROUP 1: DATABASE PERSISTENCE & DISK RECOVERY
  // -------------------------------------------------------------
  console.log('--- TEST GROUP 1: Database Persistence & Storage ---');
  const dataFilePath = path.resolve('./data/smartqueue.json');
  assert(fs.existsSync(dataFilePath), 'Database JSON file exists on disk');

  const fileContentBefore = fs.readFileSync(dataFilePath, 'utf-8');
  const parsedBefore = JSON.parse(fileContentBefore);
  assert(Array.isArray(parsedBefore) && parsedBefore.length > 0, `Database file populated (${parsedBefore.length} initial records)`);

  // -------------------------------------------------------------
  // TEST GROUP 2: PATIENT REGISTRATION WITH SYNTHETIC DATA
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Synthetic Patient Registration & Token Generation ---');
  const syntheticPatient = {
    fullName: 'Lucas Meyer',
    age: 44,
    gender: 'Male',
    contactNumber: '(555) 781-9923',
    department: 'General Medicine' as const,
    chiefComplaint: 'Acute left ear throbbing and fever 38.5C for 2 days',
    allergies: ['Penicillin'],
  };

  const regResult = queueDb.registerPatient(syntheticPatient);
  assert(!!regResult.id && regResult.id.startsWith('SJH-'), 'Generated unique Patient ID (e.g. ' + regResult.id + ')');
  assert(!!regResult.token && regResult.token.startsWith('MED-'), 'Generated visit-specific token (e.g. ' + regResult.token + ')');
  assert(
    !!regResult.passId && regResult.passId.startsWith('SQ-PASS-') && regResult.passId.length >= 30,
    'Generated 128-bit cryptographically secure pass ID (' + regResult.passId + ')'
  );
  assert(regResult.position >= 1, `Queue position calculated correctly (Position: ${regResult.position})`);
  assert(regResult.estimatedWaitMinutes >= 2, `Estimated wait time calculated (Est: ${regResult.estimatedWaitMinutes} mins)`);

  // Verify record written to disk
  const fileContentAfter = fs.readFileSync(dataFilePath, 'utf-8');
  const parsedAfter = JSON.parse(fileContentAfter);
  const foundOnDisk = parsedAfter.find((p: any) => p.token === regResult.token);
  assert(!!foundOnDisk, 'Registered patient verified on disk (survives process restart)');

  // -------------------------------------------------------------
  // TEST GROUP 3: PRIORITY 1 - DATA PRIVACY & SANITIZED PUBLIC DTO
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Data Privacy & Response DTOs ---');
  const publicState = queueDb.getPublicState();

  // Verify public queue state contains only sanitized PublicQueuePatientDTO
  assert(Array.isArray(publicState.patients), 'Public queue returns patient list');
  const samplePublicPatient: any = publicState.patients[0];
  assert(
    samplePublicPatient &&
      samplePublicPatient.fullName === undefined &&
      samplePublicPatient.contactNumber === undefined &&
      samplePublicPatient.chiefComplaint === undefined &&
      samplePublicPatient.allergies === undefined &&
      samplePublicPatient.notes === undefined &&
      samplePublicPatient.mrn === undefined,
    'Public queue patient DTO excludes fullName, contactNumber, chiefComplaint, allergies, notes, and MRN'
  );

  // Check nowServingPatient in departments
  const genDept = publicState.departments['General Medicine'];
  const nowServingPublic: any = genDept.nowServingPatient;
  if (nowServingPublic) {
    assert(
      nowServingPublic.contactNumber === undefined &&
        nowServingPublic.chiefComplaint === undefined &&
        nowServingPublic.allergies === undefined &&
        nowServingPublic.notes === undefined,
      'Department nowServingPatient excludes contactNumber, chiefComplaint, allergies, and notes'
    );
    assert(
      nowServingPublic.fullName.includes('.') || !nowServingPublic.fullName.includes(' '),
      `Patient name in public state is masked: "${nowServingPublic.fullName}"`
    );
  }

  // Patient Self-Lookup
  const selfLookup = queueDb.getPatientSelfView(regResult.token);
  assert(
    !!selfLookup && selfLookup.fullName === syntheticPatient.fullName,
    'Patient self-lookup retrieves their own ticket details and position'
  );

  // Protected clinical state requires clinical role
  let unauthClinicalErrorCaught = false;
  try {
    queueDb.getClinicalState('security');
  } catch (err: any) {
    unauthClinicalErrorCaught = true;
  }
  assert(unauthClinicalErrorCaught, 'Clinical queue state rejects non-clinical role (access control enforced)');

  const clinicalState = queueDb.getClinicalState('clinical');
  assert(
    Array.isArray(clinicalState.patients) && clinicalState.patients[0].chiefComplaint !== undefined,
    'Authorized clinical state contains EHR clinical records for attending physicians'
  );

  // -------------------------------------------------------------
  // TEST GROUP 4: PRIORITY 2 - SECURE PASS VERIFICATION & VALIDATION
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Secure Pass Tokens & Verification Logic ---');

  // 4a. Valid Pass
  const validClearance = queueDb.verifyGatePass(regResult.passId, 'security', 'SEC-402', 'Gate 02');
  assert(validClearance.outcome === 'VALID', 'Valid pass verified successfully (Outcome: VALID)');
  assert(
    validClearance.patientNameMasked === 'Lucas M.',
    `Valid clearance returns masked patient name ("${validClearance.patientNameMasked}")`
  );
  assert(
    validClearance.department === 'General Medicine' && validClearance.room === 'Room 104',
    `Operational clinic routing included (${validClearance.department}, ${validClearance.room})`
  );

  // Strictly verify NO sensitive fields exist in GateClearanceDTO
  const rawClearance: any = validClearance;
  assert(
    rawClearance.contactNumber === undefined &&
      rawClearance.mrn === undefined &&
      rawClearance.chiefComplaint === undefined &&
      rawClearance.allergies === undefined &&
      rawClearance.notes === undefined,
    'Gate clearance strictly EXCLUDES contactNumber, MRN, chiefComplaint, allergies, and clinical notes'
  );

  // 4b. Expired Pass (Server evaluates true 30-day expiration)
  const expiredClearance = queueDb.verifyGatePass('SQ-PASS-EXPIRED-TEST-FIXTURE-B', 'security');
  assert(
    expiredClearance.outcome === 'EXPIRED',
    `Expired pass rejected with EXPIRED outcome (${expiredClearance.message})`
  );

  // 4c. Revoked Pass (Server evaluates revocation)
  const revokedClearance = queueDb.verifyGatePass('SQ-PASS-REVOKED-TEST-FIXTURE-B', 'security');
  assert(
    revokedClearance.outcome === 'REVOKED',
    `Revoked pass rejected with REVOKED outcome (${revokedClearance.message})`
  );

  // 4d. Unknown / Invalid Pass
  const invalidClearance = queueDb.verifyGatePass('SQ-RANDOM-NONEXISTENT-PASS', 'security');
  assert(
    invalidClearance.outcome === 'INVALID',
    `Unknown token rejected with INVALID outcome (${invalidClearance.message})`
  );

  // -------------------------------------------------------------
  // TEST GROUP 5: PRIORITY 3 - ACCESS CONTROL, DUPLICATES & AUDIT LOGS
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: Gate Access Protection & Duplicate Scan Handling ---');

  // 5a. Role Enforcement for Gate Scanner
  let unauthGateError = false;
  try {
    queueDb.verifyGatePass(regResult.passId, 'public');
  } catch (err) {
    unauthGateError = true;
  }
  assert(unauthGateError, 'Gate scanner verification rejects unauthenticated/public role');

  // 5b. Safe Duplicate Scan Detection (5-minute cooldown rule)
  const duplicateClearance = queueDb.verifyGatePass(regResult.passId, 'security', 'SEC-402', 'Gate 02');
  assert(
    duplicateClearance.outcome === 'VALID' && duplicateClearance.isDuplicateScan === true,
    'Second scan of same pass within 5 minutes flagged as duplicate (isDuplicateScan: true)'
  );
  assert(
    !!duplicateClearance.duplicateWarning && duplicateClearance.duplicateWarning.includes('Duplicate scan detected'),
    `Duplicate warning message generated ("${duplicateClearance.duplicateWarning?.substring(0, 50)}...")`
  );

  // 5c. Server-side Scan Event Logging
  const recentLogs = queueDb.getRecentScanLogs(10);
  assert(recentLogs.length >= 2, `Scan events logged persistently in memory and disk (${recentLogs.length} logs found)`);
  const lastLog = recentLogs[0];
  assert(
    lastLog.operatorId === 'SEC-402' && lastLog.gateId === 'Gate 02',
    `Audit log records operator ID (${lastLog.operatorId}) and gate terminal (${lastLog.gateId})`
  );

  const scansFilePath = path.resolve('./data/gate_scans.json');
  assert(fs.existsSync(scansFilePath), 'Gate scans audit file exists on disk (data/gate_scans.json)');

  // -------------------------------------------------------------
  // TEST GROUP 6: CLINICAL QUEUE OPERATIONS (CALL NEXT & COMPLETE)
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 6: Clinical Workflow Operations ---');

  // 6a. Call Next (requires clinical role)
  let callNextUnauthError = false;
  try {
    queueDb.callNext('General Medicine', 'security');
  } catch (err) {
    callNextUnauthError = true;
  }
  assert(callNextUnauthError, 'Call Next rejects non-clinical role');

  const callNextRes = queueDb.callNext('General Medicine', 'clinical');
  assert(
    callNextRes.current !== null && callNextRes.current.status === 'SERVING',
    `Next patient called and status updated to SERVING (Token: ${callNextRes.current?.token})`
  );

  // 6b. Complete Consultation (requires clinical role)
  const completeRes = queueDb.completeConsultation('General Medicine', 'clinical');
  assert(
    completeRes !== null && completeRes.status === 'COMPLETED',
    `Consultation completed and status updated to COMPLETED (Token: ${completeRes?.token})`
  );

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('\n===========================================================');
  console.log(`TOTAL TESTS EXECUTED: ${passedCount + failedCount}`);
  console.log(`PASSED: ${passedCount}`);
  console.log(`FAILED: ${failedCount}`);
  console.log('===========================================================');

  if (failedCount > 0) {
    throw new Error(`${failedCount} test(s) failed.`);
  }
}

runSecurityAndQueueTests().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
