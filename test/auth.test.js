import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createPasswordHash,
  createSessionToken,
  verifyPassword,
  verifySessionToken,
} from '../src/auth.js';

describe('autenticacion', () => {
  it('valida contrasenas con scrypt', async () => {
    const hash = await createPasswordHash('una-contrasena-segura');
    assert.equal(await verifyPassword('una-contrasena-segura', hash), true);
    assert.equal(await verifyPassword('incorrecta', hash), false);
  });

  it('firma sesiones, rechaza alteraciones y respeta la expiracion', () => {
    const secret = 's'.repeat(64);
    const token = createSessionToken(secret, 1_000, 10_000);
    assert.equal(verifySessionToken(token, secret, 10_500), true);
    assert.equal(verifySessionToken(`${token}alterado`, secret, 10_500), false);
    assert.equal(verifySessionToken(token, secret, 11_001), false);
  });
});
