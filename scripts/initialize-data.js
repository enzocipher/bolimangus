import { resolve } from 'node:path';
import { JsonStore } from '../src/store.js';

const filePath = resolve(process.cwd(), process.env.DATA_FILE || './data/rifa.json');
const store = new JsonStore(filePath);
const data = await store.init();

console.log(`Datos verificados en ${filePath}`);
console.log(`${data.tickets.length} tickets listos; los pares existentes no fueron regenerados.`);
