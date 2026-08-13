import { randomInt } from 'node:crypto';

export const TICKET_COUNT = 106;
export const MIN_NUMBER = 1;
export const MAX_NUMBER = 53;

function ticketId(index) {
  return `T${String(index + 1).padStart(3, '0')}`;
}

function pairKey(first, second) {
  return `${Math.min(first, second)}:${Math.max(first, second)}`;
}

export function generateTickets({ drawNumber = (minimum, maximum) => randomInt(minimum, maximum) } = {}) {
  const candidates = [];
  for (let first = MIN_NUMBER; first < MAX_NUMBER; first += 1) {
    for (let second = first + 1; second <= MAX_NUMBER; second += 1) {
      candidates.push([first, second]);
    }
  }

  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const swapIndex = drawNumber(0, index + 1);
    [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
  }

  return candidates.slice(0, TICKET_COUNT).map(([first, second], index) => ({
    id: ticketId(index),
    first,
    second,
    buyer: null,
  }));
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

    if (ticket.first === ticket.second) {
      throw new Error(`El ticket ${ticket.id} debe contener dos numeros distintos.`);
    }

    const key = pairKey(ticket.first, ticket.second);
    if (pairs.has(key)) {
      throw new Error(`El par ${ticket.first}-${ticket.second} esta repetido, incluso considerando el orden inverso.`);
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
