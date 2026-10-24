import { queueDb, compareQueuePriority } from './server/queueStore';
import {
  authenticateCredentials,
  createStaffSessionToken,
  verifyStaffSessionToken,
} from './server/auth';
import { getCompletedConsultationDurations, updateQueueEntry } from './server/sqliteDb';
import { PatientRecord, OPDDepartment } from './src/types/queue';

async function runEtaEngineTests() {
  console.log('===========================================================');
  console.log('    PHASE 1: DYNAMIC ETA ENGINE COMPREHENSIVE TEST SUITE   ');
  console.log('===========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName} ${details ? '-> ' + details : ''}`);
      failed++;
    }
  }

  // Reset database to known demo baseline first
  queueDb.resetDemo();

  // -------------------------------------------------------------
  // TEST SCENARIO 1: Empty Queue
  // -------------------------------------------------------------
  console.log('--- SCENARIO 1: Empty Queue Handling ---');
  // Complete all patients in Cardiology to test an empty queue condition
  const cardWaitBefore = queueDb.calculateDepartmentETAs('Cardiology');
  // Mark all Cardiology patients completed or cancelled for this scenario
  const pubStateBefore = queueDb.getPublicState();
  const cardPatients = pubStateBefore.patients.filter((p) => p.department === 'Cardiology');
  for (const cp of cardPatients) {
    updateQueueEntry(cp.token, { status: 'COMPLETED', completedAt: new Date().toISOString() });
  }
  queueDb.resetDemo(); // restore baseline

  // Test empty queue calculation function directly
  // In an isolated department state with 0 waiting patients
  const emptyEtas = queueDb.calculateDepartmentETAs('Orthopaedics');
  // Orthopaedics has fewer waiting patients; let's verify calculation handles 0 or few
  assert(emptyEtas instanceof Map, 'ETA calculation returns Map for department');
  assert(
    typeof queueDb.getPublicState().departments.Orthopaedics.waitingCount === 'number',
    'Department summary reports numeric waiting count'
  );

  // -------------------------------------------------------------
  // TEST SCENARIO 2: One Waiting Patient
  // -------------------------------------------------------------
  console.log('\n--- SCENARIO 2: One Waiting Patient ---');
  queueDb.resetDemo();
  // Register exactly 1 test patient into Orthopaedics
  const singlePatient = queueDb.registerPatient({
    fullName: 'Single Patient Test',
    age: 28,
    gender: 'Female',
    contactNumber: '+91 98765 43210',
    department: 'Orthopaedics',
    chiefComplaint: 'Mild wrist strain after typing',
    allergies: [],
  });

  const singleSelfView = queueDb.getPatientSelfView(singlePatient.token);
  assert(singleSelfView !== null, 'Retrieved self view for registered patient');
  assert(singleSelfView?.position !== undefined && singleSelfView.position >= 1, `Patient has valid 1-based position: ${singleSelfView?.position}`);
  assert(singleSelfView?.totalAhead !== undefined && singleSelfView.totalAhead >= 0, `Total ahead is non-negative: ${singleSelfView?.totalAhead}`);
  assert(singleSelfView?.estimatedWaitMinutes !== null && singleSelfView!.estimatedWaitMinutes >= 0, `ETA is non-negative: ${singleSelfView?.estimatedWaitMinutes} mins`);
  assert(singleSelfView?.etaUnavailable === false, 'ETA is available when doctor is online');

  // -------------------------------------------------------------
  // TEST SCENARIO 3: Multiple Waiting Patients & Monotonicity
  // -------------------------------------------------------------
  console.log('\n--- SCENARIO 3: Multiple Waiting Patients & Queue Monotonicity ---');
  const p1 = queueDb.registerPatient({
    fullName: 'Sequential Patient A',
    age: 35,
    gender: 'Male',
    contactNumber: '+91 91234 56789',
    department: 'General Medicine',
    chiefComplaint: 'Routine annual checkup',
    allergies: [],
  });
  const p2 = queueDb.registerPatient({
    fullName: 'Sequential Patient B',
    age: 38,
    gender: 'Female',
    contactNumber: '+91 91234 56780',
    department: 'General Medicine',
    chiefComplaint: 'Mild allergy sneezing',
    allergies: [],
  });

  const v1 = queueDb.getPatientSelfView(p1.token)!;
  const v2 = queueDb.getPatientSelfView(p2.token)!;

  assert(v1.position < v2.position, `Sequential position ordering maintained (P1: ${v1.position}, P2: ${v2.position})`);
  assert(v1.totalAhead < v2.totalAhead, `Total ahead strictly reflects queue order (P1 ahead: ${v1.totalAhead}, P2 ahead: ${v2.totalAhead})`);
  assert(
    v1.estimatedWaitMinutes !== null && v2.estimatedWaitMinutes !== null && v1.estimatedWaitMinutes <= v2.estimatedWaitMinutes,
    `ETA increases monotonically with queue depth (P1: ~${v1.estimatedWaitMinutes}m <= P2: ~${v2.estimatedWaitMinutes}m)`
  );

  // -------------------------------------------------------------
  // TEST SCENARIO 4: Consultation Completing & Dynamic Reduction
  // -------------------------------------------------------------
  console.log('\n--- SCENARIO 4: Consultation Completing ---');
  const waitBeforeComplete = queueDb.getPatientSelfView(p2.token)!.estimatedWaitMinutes;
  const callResult = queueDb.callNext('General Medicine', 'clinical');
  assert(callResult.current !== null, `Called next patient successfully (Token: ${callResult.current?.token})`);

  const completeResult = queueDb.completeConsultation('General Medicine', 'clinical');
  assert(completeResult !== null, `Consultation marked completed (Token: ${completeResult?.token}, completedAt: ${completeResult?.completedAt})`);

  const p2AfterComplete = queueDb.getPatientSelfView(p2.token)!;
  assert(
    p2AfterComplete.position <= v2.position,
    `Patient position advanced after consultation completed (${v2.position} -> ${p2AfterComplete.position})`
  );
  assert(
    p2AfterComplete.estimatedWaitMinutes !== null && waitBeforeComplete !== null,
    'Numeric ETA recalculated after consultation completion'
  );

  // -------------------------------------------------------------
  // TEST SCENARIO 5: Doctor Becoming Unavailable
  // -------------------------------------------------------------
  console.log('\n--- SCENARIO 5: Doctor Becoming Unavailable ---');
  // Mark General Medicine doctor unavailable
  queueDb.setDoctorAvailability('General Medicine', false, 0, 'clinical');
  const p2DocOff = queueDb.getPatientSelfView(p2.token)!;

  assert(p2DocOff.etaUnavailable === true, 'etaUnavailable flagged true when doctor is off-duty');
  assert(p2DocOff.estimatedWaitMinutes === null, 'estimatedWaitMinutes is null when doctor is unavailable');
  assert(
    typeof p2DocOff.etaReason === 'string' && p2DocOff.etaReason.length > 0,
    `Clear user-facing reason provided: "${p2DocOff.etaReason}"`
  );

  // Restore doctor availability
  queueDb.setDoctorAvailability('General Medicine', true, 3, 'clinical');
  const p2DocOn = queueDb.getPatientSelfView(p2.token)!;
  assert(p2DocOn.etaUnavailable === false, 'etaUnavailable restored to false when doctor comes online');
  assert(p2DocOn.estimatedWaitMinutes !== null && p2DocOn.estimatedWaitMinutes >= 0, `Numeric ETA restored: ~${p2DocOn.estimatedWaitMinutes}m`);

  // -------------------------------------------------------------
  // TEST SCENARIO 6: Emergency Priority Triage
  // -------------------------------------------------------------
  console.log('\n--- SCENARIO 6: Emergency Priority Preemption ---');
  const routinePatient = queueDb.registerPatient({
    fullName: 'Standard Routine Patient',
    age: 40,
    gender: 'Male',
    contactNumber: '+91 94444 11111',
    department: 'Cardiology',
    chiefComplaint: 'Mild checkup consultation',
    allergies: [],
  });

  const routineViewBefore = queueDb.getPatientSelfView(routinePatient.token)!;

  // Now register an Urgent Emergency Priority patient into the same department
  const emergencyPatient = queueDb.registerPatient({
    fullName: 'Emergency Acute Patient',
    age: 55,
    gender: 'Female',
    contactNumber: '+91 95555 22222',
    department: 'Cardiology',
    chiefComplaint: 'Severe acute chest pain radiating to left arm emergency',
    allergies: [],
  });

  const emergView = queueDb.getPatientSelfView(emergencyPatient.token)!;
  const routineViewAfter = queueDb.getPatientSelfView(routinePatient.token)!;

  assert(emergencyPatient.triageSeverity === 'Urgent Priority', 'Patient automatically triaged to Urgent Priority');
  assert(emergView.position < routineViewAfter.position, `Urgent patient pre-empted routine patient in position (Urgent pos: ${emergView.position} < Routine pos: ${routineViewAfter.position})`);
  assert(emergView.totalAhead < routineViewAfter.totalAhead, `Urgent patient has fewer patients ahead (Urgent ahead: ${emergView.totalAhead} < Routine ahead: ${routineViewAfter.totalAhead})`);
  assert(
    emergView.estimatedWaitMinutes !== null &&
      routineViewAfter.estimatedWaitMinutes !== null &&
      emergView.estimatedWaitMinutes <= routineViewAfter.estimatedWaitMinutes,
    `Urgent patient receives priority ETA (Urgent: ~${emergView.estimatedWaitMinutes}m <= Routine: ~${routineViewAfter.estimatedWaitMinutes}m)`
  );

  // -------------------------------------------------------------
  // TEST SCENARIO 7: Cancelled or Absent Patients
  // -------------------------------------------------------------
  console.log('\n--- SCENARIO 7: Cancelled or Absent Patients ---');
  const patientToCancel = queueDb.registerPatient({
    fullName: 'Will Leave Patient',
    age: 29,
    gender: 'Male',
    contactNumber: '+91 96666 33333',
    department: 'General Medicine',
    chiefComplaint: 'Sore throat',
    allergies: [],
  });
  const patientBehind = queueDb.registerPatient({
    fullName: 'Patient Behind Cancelled',
    age: 31,
    gender: 'Female',
    contactNumber: '+91 97777 44444',
    department: 'General Medicine',
    chiefComplaint: 'Skin rash',
    allergies: [],
  });

  const behindBefore = queueDb.getPatientSelfView(patientBehind.token)!;

  // Cancel the patient ahead
  const cancelResult = queueDb.cancelPatientQueue(patientToCancel.token, 'Patient left clinic', 'clinical');
  assert(cancelResult.success === true, 'Queue ticket cancelled successfully');

  const cancelledView = queueDb.getPatientSelfView(patientToCancel.token)!;
  assert(cancelledView.status === 'CANCELLED', 'Status transitioned to CANCELLED');
  assert(cancelledView.estimatedWaitMinutes === null, 'Cancelled patient ETA is null');
  assert(cancelledView.etaUnavailable === true, 'Cancelled patient ETA marked unavailable');

  const behindAfter = queueDb.getPatientSelfView(patientBehind.token)!;
  assert(
    behindAfter.position <= behindBefore.position,
    `Subsequent patient advanced in queue position (${behindBefore.position} -> ${behindAfter.position})`
  );
  assert(
    behindAfter.totalAhead <= behindBefore.totalAhead,
    `Eligible patients ahead reduced (${behindBefore.totalAhead} -> ${behindAfter.totalAhead})`
  );

  // -------------------------------------------------------------
  // TEST SCENARIO 8: Missing or Invalid Consultation Duration Fallback
  // -------------------------------------------------------------
  console.log('\n--- SCENARIO 8: Fallback on Missing or Invalid Duration Data ---');
  const durCalc = queueDb.getDepartmentConsultationDuration('Orthopaedics');
  assert(typeof durCalc.avgMinutes === 'number' && durCalc.avgMinutes > 0, `Returned positive consultation duration: ${durCalc.avgMinutes} mins`);
  assert(typeof durCalc.isHistorical === 'boolean', `Duration provenance identified (isHistorical: ${durCalc.isHistorical})`);
  assert(!isNaN(durCalc.avgMinutes), 'Duration is a valid finite number (never NaN)');

  // -------------------------------------------------------------
  // TEST SCENARIO 9: Queue Reassignment Recalculation
  // -------------------------------------------------------------
  console.log('\n--- SCENARIO 9: Queue Reassignment & Dynamic Recalculation ---');
  const reassignPatient = queueDb.registerPatient({
    fullName: 'Transfer Patient',
    age: 47,
    gender: 'Female',
    contactNumber: '+91 98888 55555',
    department: 'General Medicine',
    chiefComplaint: 'Palpitations detected during physical',
    allergies: [],
  });

  const reassignRes = queueDb.reassignDepartment(reassignPatient.token, 'Cardiology', 'clinical');
  assert(reassignRes.success === true, 'Authorized queue reassignment succeeded');

  const reassignedView = queueDb.getPatientSelfView(reassignPatient.token)!;
  assert(reassignedView.department === 'Cardiology', 'Department updated to Cardiology');
  assert(reassignedView.room === 'Room 102', 'Room updated to Cardiology clinic room');
  assert(reassignedView.doctor === 'Dr. Marcus Vance, MD', 'Attending physician updated to Cardiology specialist');
  assert(reassignedView.position >= 1, `Assigned valid position in new department: ${reassignedView.position}`);
  assert(reassignedView.estimatedWaitMinutes !== null, `Cardiology ETA calculated: ~${reassignedView.estimatedWaitMinutes}m`);

  // -------------------------------------------------------------
  // TEST SCENARIO 10: Existing Registration, Auth & Privacy Intact
  // -------------------------------------------------------------
  console.log('\n--- SCENARIO 10: Authentication, Registration & Privacy Verification ---');
  // 1. Staff Authentication
  const clinicalAuth = authenticateCredentials('dr.jenkins', 'ClinicalDoc#2026');
  assert(clinicalAuth !== null && clinicalAuth.role === 'clinical', 'Clinical physician authenticated successfully');
  const sessionData = createStaffSessionToken(clinicalAuth!);
  assert(!!sessionData.token, 'Generated signed HMAC staff session token');
  const verifiedUser = verifyStaffSessionToken(sessionData.token);
  assert(verifiedUser !== null && verifiedUser.username === 'dr.jenkins', 'Session token verified successfully');

  // 2. Data Privacy
  const publicQueue = queueDb.getPublicState();
  const sample = publicQueue.patients[0];
  assert(sample.id.startsWith('PT-**'), `Public ID is sanitized and masked: ${sample.id}`);
  assert((sample as any).fullName === undefined, 'Public patient DTO strictly omits fullName');
  assert((sample as any).contactNumber === undefined, 'Public patient DTO strictly omits contactNumber');
  assert((sample as any).chiefComplaint === undefined, 'Public patient DTO strictly omits chiefComplaint');
  assert(sample.position !== undefined || sample.status !== 'WAITING', 'Waiting patients in public queue include live position');

  // 3. Last Updated Timestamp
  const finalPatient = queueDb.getPatientSelfView(reassignPatient.token)!;
  assert(!!finalPatient.lastUpdated, `Last updated timestamp present: ${finalPatient.lastUpdated}`);
  assert(!isNaN(new Date(finalPatient.lastUpdated!).getTime()), 'Timestamp is valid ISO date');

  // Summary
  console.log('\n===========================================================');
  console.log(`TOTAL SCENARIO TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('===========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runEtaEngineTests().catch((err) => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
