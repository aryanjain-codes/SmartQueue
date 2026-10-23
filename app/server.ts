import 'dotenv/config';
import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { queueDb } from './server/queueStore';
import { OPDDepartment, RegistrationPayload, StaffRole } from './src/types/queue';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Staff Auth Constants - Configurable via environment variables (with secure demo defaults)
export const SECURITY_AUTH_TOKEN = process.env.SECURITY_AUTH_TOKEN || 'sec-gate-token-402';
export const CLINICAL_AUTH_TOKEN = process.env.CLINICAL_AUTH_TOKEN || 'cln-med-token-104';

interface AuthContext {
  role: StaffRole;
  operatorId?: string;
  name?: string;
}

function authenticateStaff(req: Request): AuthContext {
  const authHeader = req.headers['authorization'] || '';
  const tokenHeader = (req.headers['x-staff-token'] as string) || '';
  const bearerToken = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const token = bearerToken || tokenHeader;

  if (token === SECURITY_AUTH_TOKEN) {
    return {
      role: 'security',
      operatorId: 'SEC-402',
      name: 'Officer T. Briggs (Gate 02)',
    };
  }

  if (token === CLINICAL_AUTH_TOKEN) {
    return {
      role: 'clinical',
      operatorId: 'CLN-104',
      name: 'Dr. Sarah Jenkins, MD',
    };
  }

  return { role: 'public' };
}

// Rate Limiter for Gate Scanner Terminal
const scanRateLimitMap = new Map<string, number[]>();
const SCAN_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_SCANS_PER_WINDOW = 30;

function checkScannerRateLimit(clientIp: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const timestamps = scanRateLimitMap.get(clientIp) || [];
  const validTimestamps = timestamps.filter((t) => now - t < SCAN_RATE_LIMIT_WINDOW_MS);

  if (validTimestamps.length >= MAX_SCANS_PER_WINDOW) {
    const oldest = validTimestamps[0];
    const retryAfter = Math.ceil((oldest + SCAN_RATE_LIMIT_WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfter };
  }

  validTimestamps.push(now);
  scanRateLimitMap.set(clientIp, validTimestamps);
  return { allowed: true };
}

async function startServer() {
  const app = express();
  app.use(express.json());

  
  // Allow the deployed Netlify frontend to call this API
  app.use((req: Request, res: Response, next) => {
    const allowedOrigin = 'https://smartqueue-fsp.netlify.app';

    if (req.headers.origin === allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
      res.setHeader('Vary', 'Origin');
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, PATCH, DELETE, OPTIONS'
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Staff-Token'
      );
    }

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }

    next();
  });


  // Log API requests
  app.use('/api', (req, _res, next) => {
    console.log(`[API] ${req.method} ${req.path}`);
    next();
  });

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // GET /api/queue: Public queue state (strictly sanitized DTO, no sensitive clinical records)
  app.get('/api/queue', (_req: Request, res: Response) => {
    try {
      const publicState = queueDb.getPublicState();
      res.json(publicState);
    } catch (err: any) {
      console.error('Error getting queue state:', err);
      res.status(500).json({ error: 'Failed to retrieve queue state', message: err.message });
    }
  });

  // GET /api/staff/queue: Protected clinical queue state with EHR records (requires Clinical staff role)
  app.get('/api/staff/queue', (req: Request, res: Response) => {
    try {
      const auth = authenticateStaff(req);
      if (auth.role !== 'clinical') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Clinical staff role required to view protected queue state.',
        });
      }

      const clinicalState = queueDb.getClinicalState('clinical');
      res.json(clinicalState);
    } catch (err: any) {
      console.error('Error getting clinical queue state:', err);
      res.status(500).json({ error: 'Failed to retrieve clinical queue state', message: err.message });
    }
  });

  // GET /api/token/:query: Patient self-lookup by their own token, MRN, patient ID, or pass ID
  app.get('/api/token/:query', (req: Request, res: Response) => {
    try {
      const { query } = req.params;
      const patientView = queueDb.getPatientSelfView(query);
      if (!patientView) {
        return res.status(404).json({ error: 'Patient or Token not found', query });
      }
      res.json(patientView);
    } catch (err: any) {
      console.error('Error looking up token:', err);
      res.status(500).json({ error: 'Lookup failed', message: err.message });
    }
  });

  // GET /api/staff/patient/:query: Protected clinical chart retrieval (requires Clinical staff role)
  app.get('/api/staff/patient/:query', (req: Request, res: Response) => {
    try {
      const auth = authenticateStaff(req);
      if (auth.role !== 'clinical') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Clinical staff credentials required to view patient chart.',
        });
      }

      const { query } = req.params;
      const patientRecord = queueDb.getClinicalPatientRecord(query, 'clinical');
      if (!patientRecord) {
        return res.status(404).json({ error: 'Patient record not found', query });
      }
      res.json(patientRecord);
    } catch (err: any) {
      console.error('Error fetching patient chart:', err);
      res.status(500).json({ error: 'Failed to retrieve patient chart', message: err.message });
    }
  });

  // POST /api/register: Register new OPD patient with synthetic data
  app.post('/api/register', (req: Request, res: Response) => {
    try {
      const body: RegistrationPayload = req.body;

      // Validate inputs
      if (!body.fullName || body.fullName.trim().length < 2) {
        return res.status(400).json({ error: 'Full Legal Name is required (min 2 characters)' });
      }
      const ageNum = Number(body.age);
      if (isNaN(ageNum) || ageNum < 0 || ageNum > 125) {
        return res.status(400).json({ error: 'Valid age between 0 and 125 is required' });
      }

      // Contact number validation & normalization (supporting +91 Indian mobile format)
      const rawContact = String(body.contactNumber || '').trim();
      const digitsOnly = rawContact.replace(/\D/g, '');
      if (!rawContact || digitsOnly.length < 7) {
        return res.status(400).json({ error: 'Valid contact mobile number is required' });
      }

      let normalizedContact = rawContact;
      if (rawContact.startsWith('+91') || (digitsOnly.length === 12 && digitsOnly.startsWith('91'))) {
        const localDigits = digitsOnly.startsWith('91') && digitsOnly.length === 12 ? digitsOnly.slice(2) : digitsOnly;
        if (localDigits.length !== 10) {
          return res.status(400).json({ error: 'Indian mobile number must be exactly 10 digits after +91' });
        }
        if (!/^[6-9]\d{9}$/.test(localDigits)) {
          return res.status(400).json({ error: 'Indian mobile number must start with 6, 7, 8, or 9' });
        }
        normalizedContact = `+91 ${localDigits.slice(0, 5)} ${localDigits.slice(5)}`;
      }

      const allowedDepts: OPDDepartment[] = ['General Medicine', 'Cardiology', 'Orthopaedics'];
      if (!allowedDepts.includes(body.department)) {
        return res.status(400).json({
          error: `Invalid department. Must be one of: ${allowedDepts.join(', ')}`,
        });
      }
      if (!body.chiefComplaint || body.chiefComplaint.trim().length < 3) {
        return res.status(400).json({ error: 'Primary reason / chief complaint is required for triage' });
      }

      const patientView = queueDb.registerPatient({
        fullName: body.fullName.trim(),
        age: ageNum,
        gender: body.gender || 'Male',
        contactNumber: normalizedContact,
        mrn: body.mrn?.trim(),
        department: body.department,
        chiefComplaint: body.chiefComplaint.trim(),
        allergies: Array.isArray(body.allergies) ? body.allergies : [],
      });

      console.log(`[SmartQueue] Registered new patient: ${patientView.fullName} -> Token ${patientView.token} (${patientView.department})`);
      res.status(201).json(patientView);
    } catch (err: any) {
      console.error('Registration error:', err);
      res.status(500).json({ error: 'Registration failed', message: err.message });
    }
  });

  // POST /api/staff/call-next: Staff action to call next patient in department (Clinical role required)
  app.post('/api/staff/call-next', (req: Request, res: Response) => {
    try {
      const auth = authenticateStaff(req);
      if (auth.role !== 'clinical') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Clinical staff role required to call next patient.',
        });
      }

      const { department } = req.body;
      const allowedDepts: OPDDepartment[] = ['General Medicine', 'Cardiology', 'Orthopaedics'];
      const targetDept: OPDDepartment = allowedDepts.includes(department) ? department : 'General Medicine';

      const result = queueDb.callNext(targetDept, 'clinical');
      res.json({
        success: true,
        department: targetDept,
        previous: result.previous,
        current: result.current,
        state: queueDb.getClinicalState('clinical'),
      });
    } catch (err: any) {
      console.error('Error calling next patient:', err);
      res.status(500).json({ error: 'Call next failed', message: err.message });
    }
  });

  // POST /api/staff/complete: Staff action to complete consultation (Clinical role required)
  app.post('/api/staff/complete', (req: Request, res: Response) => {
    try {
      const auth = authenticateStaff(req);
      if (auth.role !== 'clinical') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Clinical staff role required to complete consultation.',
        });
      }

      const { department } = req.body;
      const allowedDepts: OPDDepartment[] = ['General Medicine', 'Cardiology', 'Orthopaedics'];
      const targetDept: OPDDepartment = allowedDepts.includes(department) ? department : 'General Medicine';

      const completed = queueDb.completeConsultation(targetDept, 'clinical');
      res.json({
        success: true,
        department: targetDept,
        completed,
        state: queueDb.getClinicalState('clinical'),
      });
    } catch (err: any) {
      console.error('Error completing consultation:', err);
      res.status(500).json({ error: 'Complete consultation failed', message: err.message });
    }
  });

  // POST /api/staff/hold-lab: Staff action to send patient to lab hold (Clinical role required)
  app.post('/api/staff/hold-lab', (req: Request, res: Response) => {
    try {
      const auth = authenticateStaff(req);
      if (auth.role !== 'clinical') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Clinical staff role required to place lab hold.',
        });
      }

      const { token } = req.body;
      if (!token) return res.status(400).json({ error: 'Token is required' });

      const updated = queueDb.holdForLab(token, 'clinical');
      if (!updated) return res.status(404).json({ error: 'Token not found' });

      res.json({ success: true, patient: updated, state: queueDb.getClinicalState('clinical') });
    } catch (err: any) {
      console.error('Error placing hold:', err);
      res.status(500).json({ error: 'Hold failed', message: err.message });
    }
  });

  // POST /api/staff/call-token: Staff action to call specific token (Clinical role required)
  app.post('/api/staff/call-token', (req: Request, res: Response) => {
    try {
      const auth = authenticateStaff(req);
      if (auth.role !== 'clinical') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Clinical staff role required to call token.',
        });
      }

      const { token } = req.body;
      if (!token) return res.status(400).json({ error: 'Token is required' });

      const called = queueDb.callSpecificToken(token, 'clinical');
      if (!called) return res.status(404).json({ error: 'Token not found' });

      res.json({ success: true, patient: called, state: queueDb.getClinicalState('clinical') });
    } catch (err: any) {
      console.error('Error calling specific token:', err);
      res.status(500).json({ error: 'Call token failed', message: err.message });
    }
  });

  // POST /api/scanner/verify: Gate Scanner Endpoint (Security or Clinical staff role required)
  app.post('/api/scanner/verify', (req: Request, res: Response) => {
    try {
      // 1. Rate Limiting Check
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown-client';
      const rateLimitCheck = checkScannerRateLimit(clientIp);
      if (!rateLimitCheck.allowed) {
        return res.status(429).json({
          error: 'Too Many Requests',
          message: `Scanner rate limit exceeded. Please wait ${rateLimitCheck.retryAfter || 60} seconds before next scan.`,
          retryAfter: rateLimitCheck.retryAfter || 60,
        });
      }

      // 2. Authentication & Role Check (Priority 3)
      const auth = authenticateStaff(req);
      if (auth.role !== 'security' && auth.role !== 'clinical') {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Security or Clinical staff authorization required for gate verification.',
        });
      }

      // 3. Verification Execution
      const { code, gateId = 'Gate 02' } = req.body;
      const verification = queueDb.verifyGatePass(
        code || '',
        auth.role,
        auth.operatorId || 'SEC-402',
        gateId
      );

      // Return sanitized operational clearance DTO strictly excluding unnecessary sensitive personal details
      res.json(verification);
    } catch (err: any) {
      console.error('Error verifying pass:', err);
      res.status(500).json({ error: 'Verification error', message: err.message });
    }
  });

  // GET /api/scanner/logs: View gate scan audit log (Security or Clinical staff role required)
  app.get('/api/scanner/logs', (req: Request, res: Response) => {
    try {
      const auth = authenticateStaff(req);
      if (auth.role !== 'security' && auth.role !== 'clinical') {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Security or Clinical credentials required to view gate scan logs.',
        });
      }

      const logs = queueDb.getRecentScanLogs(25);
      res.json(logs);
    } catch (err: any) {
      console.error('Error getting scan logs:', err);
      res.status(500).json({ error: 'Failed to retrieve scan logs', message: err.message });
    }
  });

  // POST /api/scanner/pass-status: Update pass status (active/expired/revoked) - Security or Clinical role
  app.post('/api/scanner/pass-status', (req: Request, res: Response) => {
    try {
      const auth = authenticateStaff(req);
      if (auth.role !== 'security' && auth.role !== 'clinical') {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Security or Clinical staff authorization required to update pass status.',
        });
      }

      const { code, status } = req.body;
      if (!code || !['active', 'expired', 'revoked'].includes(status)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Valid code and status (active, expired, revoked) are required.',
        });
      }

      const result = queueDb.updatePassStatus(code, status, auth.role);
      if (!result.success || !result.patient) {
        return res.status(404).json({ error: 'Pass or patient not found', code });
      }

      res.json(result);
    } catch (err: any) {
      console.error('Error updating pass status:', err);
      res.status(500).json({ error: 'Failed to update pass status', message: err.message });
    }
  });

  // POST /api/reset-demo: Reset demo data to initial state
  app.post('/api/reset-demo', (_req: Request, res: Response) => {
    try {
      const state = queueDb.resetDemo();
      scanRateLimitMap.clear();
      res.json({ success: true, state });
    } catch (err: any) {
      console.error('Error resetting demo:', err);
      res.status(500).json({ error: 'Reset failed', message: err.message });
    }
  });

  // POST /api/backup: Create timestamped SQLite database backup (Staff authorized)
  app.post('/api/backup', (req: Request, res: Response) => {
    try {
      const auth = authenticateStaff(req);
      if (auth.role !== 'clinical' && auth.role !== 'security') {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Staff authorization required to trigger database backup.',
        });
      }
      const backupPath = queueDb.backupDatabase();
      res.json({
        success: true,
        message: 'Database backup initiated',
        backupPath: path.basename(backupPath),
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('Backup error:', err);
      res.status(500).json({ error: 'Backup failed', message: err.message });
    }
  });

  // Mount Vite or static dist
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SmartQueue] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
