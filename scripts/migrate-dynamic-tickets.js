import { copyFile, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateData } from '../src/store.js';

if (!process.argv.includes('--confirm-delete-all-tickets')) {
  console.error('Migracion cancelada. Usa --confirm-delete-all-tickets para respaldar y eliminar todos los tickets y compradores actuales.');
  process.exitCode = 1;
} else {
  const filePath = resolve(process.cwd(), process.env.DATA_FILE || './data/rifa.json');
  const raw = await readFile(filePath, 'utf8');
  const data = JSON.parse(raw);

  if (![1, 2].includes(data.version) || !Array.isArray(data.tickets)) {
    throw new Error('El archivo no tiene una version o lista de tickets compatible con esta migracion.');
  }

  const removedTickets = data.tickets.length;
  const removedBuyers = data.tickets.filter((ticket) => ticket?.buyer).length;
  const timestamp = new Date().toISOString().replaceAll(':', '-');
  const backupPath = resolve(dirname(filePath), `rifa.pre-tickets-dinamicos-${timestamp}.json`);
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;

  data.version = 2;
  data.tickets = [];
  if (data.raffle) {
    data.raffle.subtitle = 'Elige dos numeros distintos del 1 al 53';
    data.raffle.description = 'Elige tu propio par de numeros, registra tus datos y coordina el pago con la organizacion.';
  }
  data.updatedAt = new Date().toISOString();
  validateData(data);

  try {
    await writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    await copyFile(filePath, backupPath);
    await rename(temporaryPath, filePath);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }

  console.log(`Migracion completada: ${removedTickets} tickets y ${removedBuyers} compradores eliminados.`);
  console.log(`Respaldo anterior: ${backupPath}`);
}
