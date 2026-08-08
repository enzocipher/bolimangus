import { resolve } from 'node:path';

function required(env, name, minimumLength = 1) {
  const value = env[name]?.trim();
  if (!value || value.length < minimumLength) {
    throw new Error(`La variable ${name} es obligatoria y debe tener al menos ${minimumLength} caracteres.`);
  }
  return value;
}

function parsePort(value) {
  const port = Number.parseInt(value ?? '3000', 10);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT debe ser un numero entre 1 y 65535.');
  }
  return port;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined) return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error('Las variables booleanas solo aceptan true o false.');
}

export function createConfig(env = process.env) {
  const root = process.cwd();
  const adminPasswordHash = required(env, 'ADMIN_PASSWORD_HASH', 32);
  if (!adminPasswordHash.startsWith('scrypt$')) {
    throw new Error('ADMIN_PASSWORD_HASH debe generarse con pnpm create-secrets.');
  }

  return Object.freeze({
    host: env.HOST?.trim() || '127.0.0.1',
    port: parsePort(env.PORT),
    adminPasswordHash,
    sessionSecret: required(env, 'SESSION_SECRET', 48),
    cookieSecure: parseBoolean(env.COOKIE_SECURE),
    httpsOnly: parseBoolean(env.HTTPS_ONLY),
    dataFile: resolve(root, env.DATA_FILE || './data/rifa.json'),
    uploadDir: resolve(root, env.UPLOAD_DIR || './public/uploads'),
    tempUploadDir: resolve(root, env.TEMP_UPLOAD_DIR || './data/temp-uploads'),
    publicDir: resolve(root, './public'),
    sessionMaxAgeMs: 8 * 60 * 60 * 1000,
    maxImageBytes: 5 * 1024 * 1024,
  });
}
