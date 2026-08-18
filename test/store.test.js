import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { JsonStore, validateData } from '../src/store.js';

const temporaryDirectories = [];

async function createTemporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'rifa-store-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('almacen JSON', () => {
  it('genera los tickets solo cuando el archivo no existe', async () => {
    const directory = await createTemporaryDirectory();
    const file = join(directory, 'rifa.json');
    const store = new JsonStore(file);
    const initial = await store.init();
    assert.equal(initial.tickets.length, 106);
    assert.equal(validateData(initial), true);

    const pairsBefore = initial.tickets.map((ticket) => `${ticket.first}:${ticket.second}`);
    const reloaded = await new JsonStore(file).init();
    assert.deepEqual(reloaded.tickets.map((ticket) => `${ticket.first}:${ticket.second}`), pairsBefore);
  });

  it('guarda atomically, crea respaldo y no cambia el par al asignar comprador', async () => {
    const directory = await createTemporaryDirectory();
    const file = join(directory, 'rifa.json');
    const store = new JsonStore(file);
    const initial = await store.init();
    const originalPair = [initial.tickets[0].first, initial.tickets[0].second];

    await store.update((data) => {
      data.tickets[0].buyer = {
        name: 'Participante de prueba',
        phone: '999999999',
        notes: 'Dato privado',
        paymentStatus: 'pending',
        source: 'public',
        assignedAt: new Date().toISOString(),
      };
    });

    const saved = JSON.parse(await readFile(file, 'utf8'));
    assert.deepEqual([saved.tickets[0].first, saved.tickets[0].second], originalPair);
    assert.equal(saved.tickets[0].buyer.name, 'Participante de prueba');
    await access(join(directory, 'rifa.backup.json'));
  });

  it('no regenera silenciosamente un archivo corrupto', async () => {
    const directory = await createTemporaryDirectory();
    const file = join(directory, 'rifa.json');
    await writeFile(file, '{contenido-invalido', 'utf8');
    const store = new JsonStore(file);
    await assert.rejects(() => store.init(), /no se regeneraron/i);
    assert.equal(await readFile(file, 'utf8'), '{contenido-invalido');
  });
});
