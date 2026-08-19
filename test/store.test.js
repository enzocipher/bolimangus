import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { createDefaultData, JsonStore, validateData } from '../src/store.js';

const temporaryDirectories = [];

async function createTemporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'rifa-store-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('almacen JSON dinamico', () => {
  it('crea la version 2 sin tickets predefinidos', async () => {
    const directory = await createTemporaryDirectory();
    const file = join(directory, 'rifa.json');
    const initial = await new JsonStore(file).init();
    assert.equal(initial.version, 2);
    assert.deepEqual(initial.tickets, []);
    assert.equal(validateData(initial), true);
    assert.deepEqual((await new JsonStore(file).init()).tickets, []);
  });

  it('guarda atomicamente una reserva y crea respaldo', async () => {
    const directory = await createTemporaryDirectory();
    const file = join(directory, 'rifa.json');
    const store = new JsonStore(file);
    await store.init();
    await store.update((data) => {
      data.tickets.push({
        id: 'T-PRUEBA1',
        first: 12,
        second: 1,
        buyer: {
          name: 'Participante de prueba',
          phone: '999999999',
          notes: '',
          paymentStatus: 'pending',
          source: 'public',
          assignedAt: new Date().toISOString(),
        },
      });
    });
    const saved = JSON.parse(await readFile(file, 'utf8'));
    assert.equal(saved.tickets.length, 1);
    assert.deepEqual([saved.tickets[0].first, saved.tickets[0].second], [12, 1]);
    await access(join(directory, 'rifa.backup.json'));
  });

  it('acepta premios antiguos con imageUrl y limita la galeria nueva a tres imagenes', async () => {
    const legacy = createDefaultData();
    delete legacy.prizes[0].imageUrls;
    legacy.prizes[0].imageUrl = '/uploads/premio-antiguo.png';
    assert.equal(validateData(legacy), true);

    legacy.prizes[0].imageUrls = [
      '/uploads/uno.png',
      '/uploads/dos.png',
      '/uploads/tres.png',
      '/uploads/cuatro.png',
    ];
    assert.throws(() => validateData(legacy), /mas de 3 imagenes/i);
  });

  it('no modifica silenciosamente un archivo corrupto o antiguo', async () => {
    const directory = await createTemporaryDirectory();
    const file = join(directory, 'rifa.json');
    await writeFile(file, '{contenido-invalido', 'utf8');
    await assert.rejects(() => new JsonStore(file).init(), /no se modificaron/i);
    assert.equal(await readFile(file, 'utf8'), '{contenido-invalido');
  });
});
