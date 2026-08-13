import { copyFile, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateData } from '../src/store.js';
import { generateTickets } from '../src/tickets.js';

if (!process.argv.includes('--confirm')) {
  console.error('Regeneracion cancelada. Ejecuta el comando con --confirm despues de revisar que no existan compradores.');
  process.exitCode = 1;
} else {
  const filePath = resolve(process.cwd(), process.env.DATA_FILE || './data/rifa.json');
  const raw = await readFile(filePath, 'utf8');
  const data = JSON.parse(raw);

  if (!Array.isArray(data.tickets)) {
    throw new Error('El archivo no contiene una lista de tickets valida.');
  }

  const soldCount = data.tickets.filter((ticket) => ticket?.buyer).length;
  if (soldCount > 0) {
    throw new Error(`Regeneracion cancelada: existen ${soldCount} tickets con comprador.`);
  }

  const timestamp = new Date().toISOString().replaceAll(':', '-');
  const backupPath = resolve(dirname(filePath), `rifa.pre-regeneracion-${timestamp}.json`);
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;

  data.tickets = generateTickets();
  if (data.raffle?.subtitle === '106 oportunidades, dos numeros por ticket') {
    data.raffle.subtitle = '53 oportunidades, dos numeros distintos por ticket';
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

  console.log(`Se regeneraron ${data.tickets.length} tickets sin numeros iguales ni pares inversos.`);
  console.log(`Respaldo anterior: ${backupPath}`);
}
