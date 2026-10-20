import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { queueDb } from './server/queueStore';
import { OPDDepartment, RegistrationPayload } from './src/types/queue';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.use(express.json());

  // Log API requests
  app.use('/api', (req, _res, next) => {
    console.log(`[API] ${req.method} ${req.path}`);
    next();
  });

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // Get full queue state
  app.get('/api/queue', (_req: Request, res: Response) => {
    try {
      const state = queueDb.getState();
      res.json(state);
    } catch (err: any) {
      console.error('Error getting queue state:', err);
      res.status(500).json({ error: 'Failed to retrieve queue state', message: err.message });
    }
  });

  // Look up patient by token, MRN, patient ID, or pass ID
  app.get('/api/token/:query', (req: Request, res: Response) => {
    try {
      const { query } = req.params;
      const patientView = queueDb.getPatientView(query);
      if (!patientView) {
        return res.status(404).json({ error: 'Patient or Token not found', query });
      }
      res.json(patientView);
    } catch (err: any) {
      console.error('Error looking up token:', err);
      res.status(500).json({ error: 'Lookup failed', message: err.message });
    }
  });

  // Register new OPD patient
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
      if (!body.contactNumber || body.contactNumber.trim().length < 7) {
        return res.status(400).json({ error: 'Valid contact mobile number is required' });
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
        gender: body.gender || 'Not Specified',
        contactNumber: body.contactNumber.trim(),
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

  // Staff action: Call Next Patient in department
  app.post('/api/staff/call-next', (req: Request, res: Response) => {
    try {
      const { department } = req.body;
      const allowedDepts: OPDDepartment[] = ['General Medicine', 'Cardiology', 'Orthopaedics'];
      const targetDept: OPDDepartment = allowedDepts.includes(department) ? department : 'General Medicine';

      const result = queueDb.callNext(targetDept);
      res.json({
        success: true,
        department: targetDept,
        previous: result.previous,
        current: result.current,
        state: queueDb.getState(),
      });
    } catch (err: any) {
      console.error('Error calling next patient:', err);
      res.status(500).json({ error: 'Call next failed', message: err.message });
    }
  });

  // Staff action: Complete Consultation
  app.post('/api/staff/complete', (req: Request, res: Response) => {
    try {
      const { department } = req.body;
      const allowedDepts: OPDDepartment[] = ['General Medicine', 'Cardiology', 'Orthopaedics'];
      const targetDept: OPDDepartment = allowedDepts.includes(department) ? department : 'General Medicine';

      const completed = queueDb.completeConsultation(targetDept);
      res.json({
        success: true,
        department: targetDept,
        completed,
        state: queueDb.getState(),
      });
    } catch (err: any) {
      console.error('Error completing consultation:', err);
      res.status(500).json({ error: 'Complete consultation failed', message: err.message });
    }
  });

  // Staff action: Hold for Lab
  app.post('/api/staff/hold-lab', (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: 'Token is required' });

      const updated = queueDb.holdForLab(token);
      if (!updated) return res.status(404).json({ error: 'Token not found' });

      res.json({ success: true, patient: updated, state: queueDb.getState() });
    } catch (err: any) {
      console.error('Error placing hold:', err);
      res.status(500).json({ error: 'Hold failed', message: err.message });
    }
  });

  // Staff action: Call specific token directly
  app.post('/api/staff/call-token', (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: 'Token is required' });

      const called = queueDb.callSpecificToken(token);
      if (!called) return res.status(404).json({ error: 'Token not found' });

      res.json({ success: true, patient: called, state: queueDb.getState() });
    } catch (err: any) {
      console.error('Error calling specific token:', err);
      res.status(500).json({ error: 'Call token failed', message: err.message });
    }
  });

  // Gate Scanner: Verify 30-Day Pass or Token
  app.post('/api/scanner/verify', (req: Request, res: Response) => {
    try {
      const { code } = req.body;
      const verification = queueDb.verifyPassOrToken(code || '');
      res.json(verification);
    } catch (err: any) {
      console.error('Error verifying pass:', err);
      res.status(500).json({ error: 'Verification error', message: err.message });
    }
  });

  // Reset demo data to initial state
  app.post('/api/reset-demo', (_req: Request, res: Response) => {
    try {
      const state = queueDb.resetDemo();
      res.json({ success: true, state });
    } catch (err: any) {
      console.error('Error resetting demo:', err);
      res.status(500).json({ error: 'Reset failed', message: err.message });
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
