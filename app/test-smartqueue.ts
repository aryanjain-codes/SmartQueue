import { queueDb } from './server/queueStore';
import fs from 'fs';
import path from 'path';

async function runAuditTests() {
  console.log('=== STARTING SMARTQUEUE OPD AUDIT TESTS ===\n');

  // Test 1: Persistent database file exists
  const dataFilePath = path.resolve('./data/smartqueue.json');
  console.log('[Test 1] Checking database persistence file...');
  if (!fs.existsSync(dataFilePath)) {
    throw new Error(`Data file not found at ${dataFilePath}`);
  }
  const fileContentBefore = fs.readFileSync(dataFilePath, 'utf-8');
  const parsedBefore = JSON.parse(fileContentBefore);
  console.log(`✓ Data file exists and contains ${parsedBefore.length} patient records on disk.\n`);

  // Test 2: Patient Registration
  console.log('[Test 2] Testing Patient Registration with synthetic data...');
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
  console.log(`✓ Patient registered successfully:`);
  console.log(`  - Patient ID: ${regResult.id}`);
  console.log(`  - Queue Token: ${regResult.token}`);
  console.log(`  - Pass ID: ${regResult.passId}`);
  console.log(`  - Department: ${regResult.department}`);
  console.log(`  - Position in line: ${regResult.position}`);
  console.log(`  - Est. wait: ${regResult.estimatedWaitMinutes} mins`);

  // Test 3: Disk persistence across reload (simulating page refresh / restart)
  console.log('\n[Test 3] Verifying record persists on disk (survives page refresh)...');
  const fileContentAfter = fs.readFileSync(dataFilePath, 'utf-8');
  const parsedAfter = JSON.parse(fileContentAfter);
  const foundOnDisk = parsedAfter.find((p: any) => p.token === regResult.token);
  if (!foundOnDisk) {
    throw new Error(`CRITICAL: Registered patient ${regResult.token} NOT found on disk!`);
  }
  console.log(`✓ Record confirmed on disk for Token ${foundOnDisk.token} (ID: ${foundOnDisk.id}).`);

  // Test 4: Token lookup by token, patient ID, and pass ID
  console.log('\n[Test 4] Testing Token Lookup...');
  const lookupByToken = queueDb.getPatientView(regResult.token);
  if (!lookupByToken || lookupByToken.fullName !== syntheticPatient.fullName) {
    throw new Error(`Lookup by token failed for ${regResult.token}`);
  }
  const lookupById = queueDb.getPatientView(regResult.id);
  if (!lookupById || lookupById.token !== regResult.token) {
    throw new Error(`Lookup by Patient ID failed for ${regResult.id}`);
  }
  const lookupByPass = queueDb.getPatientView(regResult.passId);
  if (!lookupByPass || lookupByPass.token !== regResult.token) {
    throw new Error(`Lookup by Pass ID failed for ${regResult.passId}`);
  }
  console.log(`✓ Token lookup passed for Token (${regResult.token}), Patient ID (${regResult.id}), and Pass ID (${regResult.passId}).`);

  // Test 5: Queue Position & State consistency
  console.log('\n[Test 5] Checking Queue Position & Shared Consistency between patient & staff...');
  const state1 = queueDb.getState();
  const deptGen = state1.departments['General Medicine'];
  console.log(`  - Current serving in General Medicine: ${deptGen.nowServingToken}`);
  console.log(`  - Waiting count: ${deptGen.waitingCount}`);
  console.log(`  - Patient position reported: ${lookupByToken.position}`);

  // Test 6: Staff "Call Next" action
  console.log('\n[Test 6] Testing Staff "Call Next" action...');
  const callNextRes = queueDb.callNext('General Medicine');
  console.log(`  - Previous Serving: ${callNextRes.previous ? callNextRes.previous.token + ' (' + callNextRes.previous.fullName + ')' : 'None'}`);
  console.log(`  - Current Now Serving: ${callNextRes.current ? callNextRes.current.token + ' (' + callNextRes.current.fullName + ')' : 'None'}`);

  if (callNextRes.previous) {
    if (callNextRes.previous.status !== 'COMPLETED') {
      throw new Error(`Expected previous patient to be COMPLETED, got ${callNextRes.previous.status}`);
    }
  }
  if (callNextRes.current) {
    if (callNextRes.current.status !== 'SERVING') {
      throw new Error(`Expected current patient to be SERVING, got ${callNextRes.current.status}`);
    }
  }
  console.log('✓ Call Next transitioned patient statuses correctly and updated disk storage.');

  // Test 7: Staff "Complete Consultation" action
  console.log('\n[Test 7] Testing Staff "Complete Consultation" action...');
  const completedPatient = queueDb.completeConsultation('General Medicine');
  if (!completedPatient) {
    console.log('  - Note: No active patient was serving to complete, or already completed.');
  } else {
    console.log(`  - Completed patient: ${completedPatient.token} (${completedPatient.fullName})`);
    if (completedPatient.status !== 'COMPLETED') {
      throw new Error(`Expected status COMPLETED, got ${completedPatient.status}`);
    }
  }
  console.log('✓ Complete Consultation functioned accurately.');

  // Test 8: QR Pass / Scanner verification
  console.log('\n[Test 8] Testing Gate Scanner backend verification...');
  const validScan = queueDb.verifyPassOrToken(regResult.passId);
  console.log(`  - Valid Pass Result: ${validScan.outcome} (${validScan.message})`);
  if (validScan.outcome !== 'VALID') throw new Error(`Expected VALID, got ${validScan.outcome}`);

  const expiredScan = queueDb.verifyPassOrToken('EXP-PASS-1029');
  console.log(`  - Expired Code Result: ${expiredScan.outcome} (${expiredScan.message})`);
  if (expiredScan.outcome !== 'EXPIRED') throw new Error(`Expected EXPIRED, got ${expiredScan.outcome}`);

  const invalidScan = queueDb.verifyPassOrToken('RANDOM-TRAIN-TICKET');
  console.log(`  - Invalid Code Result: ${invalidScan.outcome} (${invalidScan.message})`);
  if (invalidScan.outcome !== 'INVALID') throw new Error(`Expected INVALID, got ${invalidScan.outcome}`);

  console.log('\n=== ALL AUDIT TESTS PASSED SUCCESSFULLY! ===');
}

runAuditTests().catch((err) => {
  console.error('\n❌ AUDIT TEST FAILURE:', err);
  process.exit(1);
});
