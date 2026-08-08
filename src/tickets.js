import { randomInt } from 'node:crypto';

export const TICKET_COUNT = 106;
export const MIN_NUMBER = 1;
export const MAX_NUMBER = 53;

function ticketId(index) {
  return `T${String(index + 1).padStart(3, '0')}`;
}

export function generateTickets({ drawNumber = (minimum, maximum) => randomInt(minimum, maximum) } = {}) {
  const pairs = new Set();
  const tickets = [];

  while (tickets.length < TICKET_COUNT) {
    const first = drawNumber(MIN_NUMBER, MAX_NUMBER + 1);
    const second = drawNumber(MIN_NUMBER, MAX_NUMBER + 1);
    const key = `${first}:${second}`;
    if (pairs.has(key)) continue;

    pairs.add(key);
    tickets.push({
      id: ticketId(tickets.length),
      first,
      second,
      buyer: null,
    });
  }

  return tickets;
}

export function validateTickets(tickets) {
  if (!Array.isArray(tickets) || tickets.length !== TICKET_COUNT) {
    throw new Error(`Deben existir exactamente ${TICKET_COUNT} tickets.`);
  }

  const pairs = new Set();
  for (const [index, ticket] of tickets.entries()) {
    const expectedId = ticketId(index);
    if (!ticket || ticket.id !== expectedId) {
      throw new Error(`El ticket en la posicion ${index + 1} debe identificarse como ${expectedId}.`);
    }
    for (const [field, value] of [['first', ticket.first], ['second', ticket.second]]) {
      if (!Number.isInteger(value) || value < MIN_NUMBER || value > MAX_NUMBER) {
        throw new Error(`${ticket.id}.${field} debe ser un entero entre ${MIN_NUMBER} y ${MAX_NUMBER}.`);
      }
    }

    const key = `${ticket.first}:${ticket.second}`;
    if (pairs.has(key)) {
      throw new Error(`El par ordenado ${ticket.first}-${ticket.second} esta repetido.`);
    }
    pairs.add(key);

    if (ticket.buyer !== null) {
      if (!ticket.buyer || typeof ticket.buyer !== 'object' || typeof ticket.buyer.name !== 'string' || !ticket.buyer.name.trim()) {
        throw new Error(`${ticket.id} contiene un comprador invalido.`);
      }
      for (const field of ['phone', 'notes', 'assignedAt']) {
        if (typeof ticket.buyer[field] !== 'string') {
          throw new Error(`${ticket.id}.buyer.${field} debe ser texto.`);
        }
      }
    }
  }

  return true;
}
