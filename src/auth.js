import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
export const COOKIE_NAME = 'rifa_admin';

function safeEqual(first, second) {
  const left = Buffer.from(first);
  const right = Buffer.from(second);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function verifyPassword(password, storedHash) {
  if (typeof password !== 'string' || password.length > 256) return false;
  const [algorithm, saltText, hashText] = storedHash.split('$');
  if (algorithm !== 'scrypt' || !saltText || !hashText) return false;
  try {
    const salt = Buffer.from(saltText, 'base64url');
    const expected = Buffer.from(hashText, 'base64url');
    const actual = await scrypt(password, salt, expected.length);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export async function createPasswordHash(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export function createSessionToken(secret, maxAgeMs, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({
    expiresAt: now + maxAgeMs,
    nonce: randomBytes(18).toString('base64url'),
  })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifySessionToken(token, secret, now = Date.now()) {
  if (typeof token !== 'string') return false;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return false;
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  if (!safeEqual(signature, expected)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number.isFinite(data.expiresAt) && data.expiresAt > now && typeof data.nonce === 'string';
  } catch {
    return false;
  }
}

export function parseCookies(header = '') {
  const cookies = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
  }
  return cookies;
}

export function sessionCookie(token, { secure, maxAgeMs }) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function expiredSessionCookie({ secure }) {
  const parts = [`${COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function createLoginLimiter({ maximumFailures = 5, windowMs = 15 * 60 * 1000 } = {}) {
  const attempts = new Map();
  return {
    canAttempt(key, now = Date.now()) {
      const entry = attempts.get(key);
      if (!entry || entry.resetAt <= now) {
        attempts.delete(key);
        return true;
      }
      return entry.failures < maximumFailures;
    },
    recordFailure(key, now = Date.now()) {
      const current = attempts.get(key);
      if (!current || current.resetAt <= now) {
        attempts.set(key, { failures: 1, resetAt: now + windowMs });
      } else {
        current.failures += 1;
      }
    },
    clear(key) {
      attempts.delete(key);
    },
  };
}
