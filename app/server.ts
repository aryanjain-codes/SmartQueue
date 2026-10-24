import 'dotenv/config';
import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { queueDb } from './server/queueStore';
import { OPDDepartment, RegistrationPayload, StaffRole } from './src/types/queue';
import {
  authenticateCredentials,
  createStaffSessionToken,
  verifyStaffSessionToken,
  revokeStaffSessionToken,
  checkLoginRateLimit,
  recordFailedLoginAttempt,
  resetLoginAttempts,
  validateProductionAuthConfig,
  authenticateStaff,
  SECURITY_AUTH_TOKEN,
  CLINICAL_AUTH_TOKEN,
  type AuthContext,
} from './server/auth';
import {
  PREDEFINED_QUESTIONS,
  isAllowedQuestionId,
  extractVerifiedQueueData,
  getAssistantAnswer,
  getQuestionById,
} from './server/assistantService';

export { SECURITY_AUTH_TOKEN, CLINICAL_AUTH_TOKEN, authenticateStaff };
export type { AuthContext };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

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
  // Validate mandatory production configuration before starting server
  const configCheck = validateProductionAuthConfig();
  if (!configCheck.valid) {
    console.error('===========================================================');
    console.error(' [FATAL] PRODUCTION CONFIGURATION ERROR - STARTUP ABORTED:');
    configCheck.errors.forEach((err) => console.error(`   ✗ ${err}`));
    console.error('===========================================================');
    throw new Error(
      `Production startup aborted due to missing required credentials: ${configCheck.errors.join('; ')}`
    );
  }

  const app = express();
  app.use(express.json());

  
  // Allow deployed frontend origins (Netlify, custom domain, localhost)
  const allowedOrigins = [
    'https://smartqueue-fsp.netlify.app',
    process.env.ALLOWED_ORIGIN,
    process.env.CORS_ORIGIN,
  ].filter(Boolean) as string[];

  app.use((req: Request, res: Response, next) => {
    const origin = req.headers.origin;

    if (
      origin &&
      (allowedOrigins.includes(origin) ||
        origin.endsWith('.netlify.app') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1'))
    ) {
      res.setHeader('Access-Control-Allow-Origin', origin);
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

  // POST /api/staff/login: Secure staff authentication endpoint
  app.post('/api/staff/login', (req: Request, res: Response) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      const rateCheck = checkLoginRateLimit(clientIp);
      if (!rateCheck.allowed) {
        return res.status(429).json({
          error: 'Too Many Requests',
          message: `Too many failed login attempts. Please wait ${rateCheck.retryAfterSeconds} seconds before trying again.`,
          retryAfter: rateCheck.retryAfterSeconds,
        });
      }

      const { username, password } = req.body || {};
      if (!username || !password) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Both username and password are required.',
        });
      }

      const user = authenticateCredentials(username, password);
      if (!user) {
        recordFailedLoginAttempt(clientIp);
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid staff username or password.',
        });
      }

      resetLoginAttempts(clientIp);
      const { token, session } = createStaffSessionToken(user);
      console.log(`[Staff Auth] Successful login for ${user.username} (${user.role}) from ${clientIp}`);

      res.json({
        success: true,
        token,
        user: {
          username: user.username,
          role: user.role,
          name: user.name,
          operatorId: user.operatorId,
        },
        expiresAt: new Date(session.expiresAt).toISOString(),
      });
    } catch (err: any) {
      console.error('Staff login error:', err);
      res.status(500).json({ error: 'Login failed', message: err.message });
    }
  });

  // GET /api/staff/session: Validate active session and return user info
  app.get('/api/staff/session', (req: Request, res: Response) => {
    try {
      const auth = authenticateStaff(req);
      if (auth.role === 'public') {
        return res.status(401).json({
          authenticated: false,
          error: 'Unauthorized',
          message: 'No active authenticated staff session found.',
        });
      }

      res.json({
        authenticated: true,
        user: {
          role: auth.role,
          operatorId: auth.operatorId,
          name: auth.name,
        },
      });
    } catch (err: any) {
      console.error('Session check error:', err);
      res.status(500).json({ error: 'Session check failed', message: err.message });
    }
  });

  // POST /api/staff/logout: Invalidate active staff session token
  app.post('/api/staff/logout', (req: Request, res: Response) => {
    try {
      const authHeader = req.headers['authorization'] || '';
      const token =
        typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
          ? authHeader.slice(7).trim()
          : '';
      if (token) {
        revokeStaffSessionToken(token);
      }
      res.json({ success: true, message: 'Logged out successfully' });
    } catch (err: any) {
      console.error('Logout error:', err);
      res.status(500).json({ error: 'Logout failed', message: err.message });
    }
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

  // GET /api/assistant/questions: Server-side allowlist of predefined FAQ questions
  app.get('/api/assistant/questions', (_req: Request, res: Response) => {
    res.json({ questions: PREDEFINED_QUESTIONS });
  });

  // POST /api/assistant/faq: SmartQueue Assistant FAQ with verified telemetry and Gemini synthesis
  app.post('/api/assistant/faq', async (req: Request, res: Response) => {
    try {
      const { questionId, token, passId } = req.body || {};
      const headerPassId = (req.headers['x-patient-pass-id'] as string) || passId;

      if (!questionId || typeof questionId !== 'string') {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Question identifier is required.',
        });
      }

      // Feature 3: Server-side allowlist validation
      if (!isAllowedQuestionId(questionId)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Unknown question identifier "${questionId}". Only predefined FAQ questions are supported.`,
          allowedQuestions: PREDEFINED_QUESTIONS.map((q) => q.id),
        });
      }

      const questionObj = getQuestionById(questionId);

      // Feature 4: Enforce patient authorization on backend
      // If the question is patient-specific or a patient token was provided, authenticate passId
      if (token || questionObj?.isPatientSpecific) {
        if (!token) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'A patient token is required for patient-specific inquiries.',
          });
        }

        const authResult = extractVerifiedQueueData(token, headerPassId);
        if (!authResult.authorized || !authResult.data) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: authResult.error || 'Valid patient pass authorization required.',
          });
        }

        const answerResponse = await getAssistantAnswer(questionId, authResult.data);
        return res.json(answerResponse);
      }

      // For general hospital workflow inquiries without patient token
      const answerResponse = await getAssistantAnswer(questionId, undefined);
      return res.json(answerResponse);
    } catch (err: any) {
      console.error('[SmartQueue Assistant] Server error:', err);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'SmartQueue Assistant encountered an unexpected error.',
      });
    }
  });

  // PATCH /api/staff/patient/:query/notes: Update clinical consultation notes (Clinical role required)
  app.patch('/api/staff/patient/:query/notes', (req: Request, res: Response) => {
    try {
      const auth = authenticateStaff(req);
      if (auth.role !== 'clinical') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Clinical staff role required to update patient notes.',
        });
      }

      const { query } = req.params;
      const { notes } = req.body;
      if (typeof notes !== 'string') {
        return res.status(400).json({ error: 'Notes string is required.' });
      }

      const result = queueDb.updatePatientNotes(query, notes, 'clinical');
      if (!result.success || !result.patient) {
        return res.status(404).json({ error: 'Patient not found', query });
      }

      res.json({ success: true, patient: result.patient });
    } catch (err: any) {
      console.error('Error updating patient notes:', err);
      res.status(500).json({ error: 'Failed to update notes', message: err.message });
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

  // POST /api/staff/cancel: Staff action to mark patient cancelled or absent (Clinical or Security role)
  app.post('/api/staff/cancel', (req: Request, res: Response) => {
    try {
      const auth = authenticateStaff(req);
      if (auth.role !== 'clinical' && auth.role !== 'security') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Staff authorization required to cancel queue ticket.',
        });
      }

      const { token, reason = 'Patient Cancelled / Absent' } = req.body;
      if (!token) return res.status(400).json({ error: 'Token is required' });

      const result = queueDb.cancelPatientQueue(token, reason, auth.role);
      if (!result.success) {
        return res.status(404).json({ error: 'Token not found or could not be cancelled', token });
      }

      res.json({
        success: true,
        patient: result.patient,
        state: auth.role === 'clinical' ? queueDb.getClinicalState('clinical') : queueDb.getPublicState(),
      });
    } catch (err: any) {
      console.error('Error cancelling queue entry:', err);
      res.status(500).json({ error: 'Cancel failed', message: err.message });
    }
  });

  // POST /api/staff/doctor-status: Staff action to toggle doctor availability / active desks
  app.post('/api/staff/doctor-status', (req: Request, res: Response) => {
    try {
      const auth = authenticateStaff(req);
      if (auth.role !== 'clinical' && auth.role !== 'security') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Staff authorization required to update doctor status.',
        });
      }

      const { department, available, activeDesks } = req.body;
      const allowedDepts: OPDDepartment[] = ['General Medicine', 'Cardiology', 'Orthopaedics'];
      if (!allowedDepts.includes(department)) {
        return res.status(400).json({ error: `Invalid department: ${department}` });
      }

      const isAvail = available !== false;
      const result = queueDb.setDoctorAvailability(department, isAvail, activeDesks, auth.role);

      res.json({
        success: true,
        result,
        state: auth.role === 'clinical' ? queueDb.getClinicalState('clinical') : queueDb.getPublicState(),
      });
    } catch (err: any) {
      console.error('Error updating doctor status:', err);
      res.status(500).json({ error: 'Update failed', message: err.message });
    }
  });

  // POST /api/staff/reassign: Clinical staff action to reassign patient to another department
  app.post('/api/staff/reassign', (req: Request, res: Response) => {
    try {
      const auth = authenticateStaff(req);
      if (auth.role !== 'clinical') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Clinical staff role required to reassign patient.',
        });
      }

      const { token, department } = req.body;
      if (!token || !department) {
        return res.status(400).json({ error: 'Token and department are required' });
      }

      const allowedDepts: OPDDepartment[] = ['General Medicine', 'Cardiology', 'Orthopaedics'];
      if (!allowedDepts.includes(department)) {
        return res.status(400).json({ error: `Invalid target department: ${department}` });
      }

      const result = queueDb.reassignDepartment(token, department, 'clinical');
      if (!result.success) {
        return res.status(404).json({ error: 'Patient not found', token });
      }

      res.json({
        success: true,
        patient: result.patient,
        state: queueDb.getClinicalState('clinical'),
      });
    } catch (err: any) {
      console.error('Error reassigning patient:', err);
      res.status(500).json({ error: 'Reassignment failed', message: err.message });
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
