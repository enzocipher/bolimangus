import { copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { generateTickets, validateTickets } from './tickets.js';

export function createDefaultData() {
  const now = new Date().toISOString();
  return {
    version: 1,
    raffle: {
      title: 'Gran Rifa Especial',
      subtitle: '53 oportunidades, dos numeros distintos por ticket',
      description: 'Participa por premios increibles. Consulta los tickets disponibles y comunicate con la organizacion para separar el tuyo.',
      drawDate: 'Fecha por confirmar',
      ticketPrice: 'Precio por confirmar',
      currency: 'S/',
      terms: 'La informacion definitiva del sorteo y la entrega de premios se publicara proximamente.',
      contact: {
        whatsapp: '',
        phone: '',
        email: '',
        instagram: '',
      },
    },
    prizes: [
      {
        id: 'premio-1',
        name: 'Primer premio',
        description: 'Agrega aqui la descripcion y la fotografia del premio principal.',
        imageUrl: null,
      },
      {
        id: 'premio-2',
        name: 'Segundo premio',
        description: 'Agrega aqui la descripcion y la fotografia del segundo premio.',
        imageUrl: null,
      },
      {
        id: 'premio-3',
        name: 'Tercer premio',
        description: 'Agrega aqui la descripcion y la fotografia del tercer premio.',
        imageUrl: null,
      },
    ],
    tickets: generateTickets(),
    createdAt: now,
    updatedAt: now,
  };
}

export function validateData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('El archivo de la rifa no contiene un objeto valido.');
  if (data.version !== 1) throw new Error('La version del archivo de la rifa no es compatible.');
  if (!data.raffle || typeof data.raffle !== 'object') throw new Error('Falta la configuracion de la rifa.');
  for (const field of ['title', 'subtitle', 'description', 'drawDate', 'ticketPrice', 'currency', 'terms']) {
    if (typeof data.raffle[field] !== 'string') throw new Error(`raffle.${field} debe ser texto.`);
  }
  if (!data.raffle.contact || typeof data.raffle.contact !== 'object') throw new Error('La informacion de contacto no es valida.');
  for (const field of ['whatsapp', 'phone', 'email', 'instagram']) {
    if (typeof data.raffle.contact[field] !== 'string') throw new Error(`raffle.contact.${field} debe ser texto.`);
  }
  if (!Array.isArray(data.prizes)) throw new Error('La lista de premios no es valida.');
  if (data.prizes.length > 20) throw new Error('La lista de premios no puede superar 20 elementos.');
  const prizeIds = new Set();
  for (const prize of data.prizes) {
    if (!prize || typeof prize.id !== 'string' || !prize.id) throw new Error('Existe un premio sin identificador.');
    if (prizeIds.has(prize.id)) throw new Error(`El premio ${prize.id} esta repetido.`);
    prizeIds.add(prize.id);
    if (typeof prize.name !== 'string' || typeof prize.description !== 'string') throw new Error(`El premio ${prize.id} no es valido.`);
    if (prize.imageUrl !== null) {
      if (typeof prize.imageUrl !== 'string' || !prize.imageUrl.startsWith('/uploads/') || basename(prize.imageUrl) !== prize.imageUrl.slice('/uploads/'.length)) {
        throw new Error(`La imagen de ${prize.id} no es valida.`);
      }
    }
  }
  validateTickets(data.tickets);
  if (typeof data.createdAt !== 'string' || typeof data.updatedAt !== 'string') throw new Error('Las fechas internas no son validas.');
  return true;
}

function clone(value) {
  return structuredClone(value);
}

export class JsonStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.backupPath = join(dirname(filePath), 'rifa.backup.json');
    this.data = null;
    this.writeQueue = Promise.resolve();
  }

  async init() {
    await mkdir(dirname(this.filePath), { recursive: true });
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const data = JSON.parse(raw);
      validateData(data);
      this.data = data;
      return this.getData();
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw new Error(`No se pudo cargar ${basename(this.filePath)}. Los tickets no se regeneraron.`, { cause: error });
      }
    }

    const initial = createDefaultData();
    validateData(initial);
    await this.#atomicWrite(initial, false);
    this.data = initial;
    return this.getData();
  }

  getData() {
    if (!this.data) throw new Error('El almacen de datos no se ha inicializado.');
    return clone(this.data);
  }

  async update(mutator) {
    const operation = this.writeQueue.then(async () => {
      const next = this.getData();
      const result = await mutator(next);
      next.updatedAt = new Date().toISOString();
      validateData(next);
      await this.#atomicWrite(next, true);
      this.data = next;
      return result === undefined ? this.getData() : clone(result);
    });

    this.writeQueue = operation.catch(() => undefined);
    return operation;
  }

  async #atomicWrite(data, createBackup) {
    const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
      if (createBackup) await copyFile(this.filePath, this.backupPath);
      await rename(temporaryPath, this.filePath);
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }
}
