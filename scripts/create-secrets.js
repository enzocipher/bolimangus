import { randomBytes, randomInt, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*-_';

function randomPassword(length = 22) {
  return Array.from({ length }, () => alphabet[randomInt(0, alphabet.length)]).join('');
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64url')}$${derivedKey.toString('base64url')}`;
}

const password = randomPassword();
const passwordHash = await hashPassword(password);
const sessionSecret = randomBytes(48).toString('base64url');

console.log('Guarda la contrasena; solo se mostrara esta vez.');
console.log(`Contrasena de /admin: ${password}`);
console.log('');
console.log('Valores para el archivo .env:');
console.log(`ADMIN_PASSWORD_HASH=${passwordHash}`);
console.log(`SESSION_SECRET=${sessionSecret}`);
