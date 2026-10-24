import crypto from 'crypto';
import { StaffRole } from '../src/types/queue';

// Ephemeral fallback secret for development and local testing only
let devEphemeralSecret: string | null = null;

/**
 * Validate that mandatory security credentials are explicitly configured in production.
 * Prevents insecure defaults, placeholder passwords, or missing signing secrets in production.
 */
export function validateProductionAuthConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd) {
    const sessionSecret = (process.env.STAFF_SESSION_SECRET || process.env.SESSION_SECRET || '').trim();
    if (!sessionSecret || sessionSecret.length < 16) {
      errors.push('STAFF_SESSION_SECRET must be configured in production with at least 16 characters.');
    }

    const clinicalPass = (process.env.STAFF_CLINICAL_PASSWORD || '').trim();
    if (!clinicalPass || clinicalPass.length < 8) {
      errors.push('STAFF_CLINICAL_PASSWORD must be explicitly set in production with at least 8 characters.');
    }

    const securityPass = (process.env.STAFF_SECURITY_PASSWORD || '').trim();
    if (!securityPass || securityPass.length < 8) {
      errors.push('STAFF_SECURITY_PASSWORD must be explicitly set in production with at least 8 characters.');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Retrieve the active session secret.
 * In production: strictly requires an environment secret; never uses a default fallback.
 * In dev/test: generates an ephemeral random secret if not configured.
 */
export function getSessionSecret(): string {
  const envSecret = process.env.STAFF_SESSION_SECRET || process.env.SESSION_SECRET;
  if (envSecret && envSecret.trim().length > 0) {
    return envSecret.trim();
  }

  if (process.env.NODE_ENV === 'production') {
    return ''; // Zero fallback in production
  }

  if (!devEphemeralSecret) {
    devEphemeralSecret = crypto.randomBytes(32).toString('hex');
  }
  return devEphemeralSecret;
}

/**
 * Account username & password getters.
 * In production: strictly requires explicit environment configuration without fallback defaults.
 */
export function getClinicalUsername(): string {
  return (process.env.STAFF_CLINICAL_USERNAME || 'dr.jenkins').trim().toLowerCase();
}

export function getClinicalPassword(): string {
  if (process.env.STAFF_CLINICAL_PASSWORD && process.env.STAFF_CLINICAL_PASSWORD.trim().length > 0) {
    return process.env.STAFF_CLINICAL_PASSWORD.trim();
  }
  if (process.env.NODE_ENV === 'production') {
    return ''; // Zero universal default in production
  }
  return 'ClinicalDoc#2026';
}

export function getSecurityUsername(): string {
  return (process.env.STAFF_SECURITY_USERNAME || 'officer.briggs').trim().toLowerCase();
}

export function getSecurityPassword(): string {
  if (process.env.STAFF_SECURITY_PASSWORD && process.env.STAFF_SECURITY_PASSWORD.trim().length > 0) {
    return process.env.STAFF_SECURITY_PASSWORD.trim();
  }
  if (process.env.NODE_ENV === 'production') {
    return ''; // Zero universal default in production
  }
  return 'GateSecurity#2026';
}

// Session expiration: default 8 hours
function getSessionDurationMs(): number {
  return (Number(process.env.STAFF_SESSION_HOURS) || 8) * 60 * 60 * 1000;
}

export interface StaffUser {
  username: string;
  role: StaffRole;
  operatorId: string;
  name: string;
}

export interface StaffSessionPayload extends StaffUser {
  sessionId: string;
  issuedAt: number;
  expiresAt: number;
}

// In-memory revoked sessions (invalidated on logout)
const revokedSessionIds = new Set<string>();

// Login rate limiting map: clientIp -> timestamp array
const loginAttemptsMap = new Map<string, number[]>();
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 mins
const MAX_LOGIN_ATTEMPTS = 5;

/**
 * Constant-time password verification using SHA-256 digests
 */
function verifyPassword(input: string, expected: string): boolean {
  if (!input || !expected) return false;
  const hashA = crypto.createHash('sha256').update(input).digest();
  const hashB = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Check and record login rate limiting per client IP
 */
export function checkLoginRateLimit(clientIp: string): { allowed: boolean; retryAfterSeconds?: number } {
  // In development and testing environments, bypass loopback lockout to allow automated test suites
  if (
    process.env.NODE_ENV !== 'production' &&
    (clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1' || clientIp === 'localhost')
  ) {
    return { allowed: true };
  }

  const now = Date.now();
  const attempts = (loginAttemptsMap.get(clientIp) || []).filter(
    (t) => now - t < LOGIN_RATE_LIMIT_WINDOW_MS
  );

  if (attempts.length >= MAX_LOGIN_ATTEMPTS) {
    const oldest = attempts[0];
    const retryAfterSeconds = Math.ceil((oldest + LOGIN_RATE_LIMIT_WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true };
}

export function recordFailedLoginAttempt(clientIp: string): void {
  const now = Date.now();
  const attempts = (loginAttemptsMap.get(clientIp) || []).filter(
    (t) => now - t < LOGIN_RATE_LIMIT_WINDOW_MS
  );
  attempts.push(now);
  loginAttemptsMap.set(clientIp, attempts);
}

export function resetLoginAttempts(clientIp: string): void {
  loginAttemptsMap.delete(clientIp);
}

/**
 * Authenticate staff user credentials against environment-configured accounts
 */
export function authenticateCredentials(
  usernameInput: string,
  passwordInput: string
): StaffUser | null {
  const normalizedUser = (usernameInput || '').trim().toLowerCase();
  const clinUser = getClinicalUsername();
  const clinPass = getClinicalPassword();
  const secUser = getSecurityUsername();
  const secPass = getSecurityPassword();

  // 1. Clinical Staff match
  if (
    normalizedUser === clinUser ||
    normalizedUser === 'doctor' ||
    normalizedUser === 'clinical'
  ) {
    if (clinPass && verifyPassword(passwordInput, clinPass)) {
      return {
        username: clinUser,
        role: 'clinical',
        operatorId: 'CLN-104',
        name: 'Dr. Sarah Jenkins, MD',
      };
    }
  }

  // 2. Security Staff match
  if (
    normalizedUser === secUser ||
    normalizedUser === 'security' ||
    normalizedUser === 'officer'
  ) {
    if (secPass && verifyPassword(passwordInput, secPass)) {
      return {
        username: secUser,
        role: 'security',
        operatorId: 'SEC-402',
        name: 'Officer T. Briggs (Gate 02)',
      };
    }
  }

  return null;
}

/**
 * Generate a cryptographically signed HMAC-SHA256 session token
 */
export function createStaffSessionToken(user: StaffUser): { token: string; session: StaffSessionPayload } {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error('STAFF_SESSION_SECRET is required to issue session tokens.');
  }

  const now = Date.now();
  const session: StaffSessionPayload = {
    ...user,
    sessionId: crypto.randomUUID(),
    issuedAt: now,
    expiresAt: now + getSessionDurationMs(),
  };

  const payloadString = Buffer.from(JSON.stringify(session)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadString)
    .digest('base64url');

  const token = `${payloadString}.${signature}`;
  return { token, session };
}

/**
 * Verify a signed session token. Checks signature, revocation, and expiration.
 */
export function verifyStaffSessionToken(token: string): StaffSessionPayload | null {
  if (!token || typeof token !== 'string') return null;

  const secret = getSessionSecret();
  if (!secret) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadString, signature] = parts;

  // Verify HMAC signature in constant time
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payloadString)
    .digest('base64url');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const sessionJson = Buffer.from(payloadString, 'base64url').toString('utf-8');
    const session = JSON.parse(sessionJson) as StaffSessionPayload;

    // Check expiration
    if (Date.now() > session.expiresAt) {
      return null;
    }

    // Check revocation
    if (revokedSessionIds.has(session.sessionId)) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

/**
 * Revoke an active session token (Logout)
 */
export function revokeStaffSessionToken(token: string): boolean {
  const session = verifyStaffSessionToken(token);
  if (session && session.sessionId) {
    revokedSessionIds.add(session.sessionId);
    return true;
  }
  return false;
}

// Staff Auth Constants - Configurable via environment variables (with secure demo defaults)
export const SECURITY_AUTH_TOKEN = process.env.SECURITY_AUTH_TOKEN || 'sec-gate-token-402';
export const CLINICAL_AUTH_TOKEN = process.env.CLINICAL_AUTH_TOKEN || 'cln-med-token-104';

export interface AuthContext {
  role: StaffRole;
  operatorId?: string;
  name?: string;
}

/**
 * Authenticate incoming request for staff credentials.
 * 1. Checks signed HMAC session token (from staff login).
 * 2. In non-production only, supports machine bearer tokens for automated integration tests.
 * In production (NODE_ENV === 'production'), machine bearer tokens are completely disabled.
 */
export function authenticateStaff(req: { headers: Record<string, string | string[] | undefined> }): AuthContext {
  const authHeader = (req.headers['authorization'] as string) || '';
  const tokenHeader = (req.headers['x-staff-token'] as string) || '';
  const bearerToken =
    typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : '';
  const token = bearerToken || tokenHeader;

  if (!token) {
    return { role: 'public' };
  }

  // 1. Verify signed HMAC session token (from /api/staff/login)
  const session = verifyStaffSessionToken(token);
  if (session) {
    return {
      role: session.role,
      operatorId: session.operatorId,
      name: session.name,
    };
  }

  // 2. Machine bearer tokens used by automated tests:
  // STRICTLY DISABLED IN PRODUCTION (NODE_ENV === 'production') to prevent login bypass!
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
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
  }

  return { role: 'public' };
}

