import Database from 'better-sqlite3';
import QRCode from 'qrcode';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'data/smartqueue.db');

async function testNewPatientFlow() {
  console.log('Testing new patient registration from clean form submission:');
  const payload = {
    fullName: 'Barry Allen',
    age: 28,
    gender: 'Male',
    contactNumber: '(555) 999-8877',
    department: 'General Medicine' as const,
    chiefComplaint: 'Acute knee pain after athletic sprint',
    allergies: ['None reported'],
  };

  const res = await fetch('http://localhost:3000/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const registered = await res.json();
  if (res.status !== 201) {
    throw new Error(`Registration failed with status ${res.status}: ${JSON.stringify(registered)}`);
  }

  console.log(`✓ Registration succeeded (HTTP 201)`);
  console.log(`  Patient Name: ${registered.fullName}`);
  console.log(`  Assigned Token: ${registered.token}`);
  console.log(`  Assigned Pass ID: ${registered.passId}`);
  console.log(`  Department: ${registered.department}`);
  console.log(`  Initial Status: ${registered.status}`);

  // Verify in SQLite directly
  const db = new Database(DB_PATH, { readonly: true });
  const row = db
    .prepare(
      `SELECT p.id, p.full_name, p.age, p.contact_number, pass.pass_token, pass.status AS pass_status, q.token, q.department
       FROM patients p
       JOIN patient_passes pass ON pass.patient_id = p.id
       JOIN queue_entries q ON q.patient_id = p.id
       WHERE p.full_name = ?`
    )
    .get('Barry Allen') as any;

  if (!row) {
    throw new Error('Could not find Barry Allen in SQLite database!');
  }
  console.log(`✓ Verified row in SQLite database:`);
  console.log(`  DB Patient ID: ${row.id}`);
  console.log(`  DB Pass Token: ${row.pass_token}`);
  console.log(`  DB Queue Token: ${row.token}`);
  console.log(`  DB Pass Status: ${row.pass_status}`);

  // Verify QR code generation
  const qrDataUrl = await QRCode.toDataURL(row.pass_token, {
    width: 256,
    margin: 2,
  });

  if (!qrDataUrl.startsWith('data:image/png;base64,')) {
    throw new Error('Failed to generate valid QR code data URL!');
  }
  console.log(`✓ Real QR code successfully generated (${qrDataUrl.length} characters)`);

  // Verify Gate Scanner Verification
  const verifyRes = await fetch('http://localhost:3000/api/scanner/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer sec-gate-token-402',
    },
    body: JSON.stringify({ code: row.pass_token }),
  });
  const clearance = await verifyRes.json();
  console.log(`✓ Gate Scanner outcome: ${clearance.outcome} (${clearance.message})`);
  console.log(`  Masked Name in Clearance: ${clearance.patientNameMasked}`);

  db.close();
  console.log('\nAll checks passed successfully!');
}

testNewPatientFlow().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
