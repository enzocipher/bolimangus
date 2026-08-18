export const MIN_NUMBER = 1;
export const MAX_NUMBER = 53;
export const MAX_UNIQUE_PAIRS = ((MAX_NUMBER - MIN_NUMBER + 1) * (MAX_NUMBER - MIN_NUMBER)) / 2;

export function pairKey(first, second) {
  return `${Math.min(first, second)}:${Math.max(first, second)}`;
}

export function samePair(ticket, first, second) {
  return pairKey(ticket.first, ticket.second) === pairKey(first, second);
}

export function validatePair(first, second) {
  for (const [field, value] of [['first', first], ['second', second]]) {
    if (!Number.isInteger(value) || value < MIN_NUMBER || value > MAX_NUMBER) {
      throw new Error(`${field} debe ser un entero entre ${MIN_NUMBER} y ${MAX_NUMBER}.`);
    }
  }
  if (first === second) throw new Error('El ticket debe contener dos numeros distintos.');
  return true;
}

export function validateTickets(tickets) {
  if (!Array.isArray(tickets)) throw new Error('La lista de tickets no es valida.');
  if (tickets.length > MAX_UNIQUE_PAIRS) throw new Error('La lista supera todos los pares unicos posibles.');

  const ids = new Set();
  const pairs = new Set();
  for (const ticket of tickets) {
    if (!ticket || typeof ticket !== 'object' || typeof ticket.id !== 'string' || !ticket.id.trim()) {
      throw new Error('Existe un ticket sin identificador valido.');
    }
    if (ids.has(ticket.id)) throw new Error(`El identificador ${ticket.id} esta repetido.`);
    ids.add(ticket.id);

    validatePair(ticket.first, ticket.second);
    const key = pairKey(ticket.first, ticket.second);
    if (pairs.has(key)) {
      throw new Error(`El par ${ticket.first}-${ticket.second} esta repetido, incluso considerando el orden inverso.`);
    }
    pairs.add(key);

    if (!ticket.buyer || typeof ticket.buyer !== 'object' || typeof ticket.buyer.name !== 'string' || !ticket.buyer.name.trim()) {
      throw new Error(`${ticket.id} contiene un comprador invalido.`);
    }
    for (const field of ['phone', 'notes', 'assignedAt']) {
      if (typeof ticket.buyer[field] !== 'string') throw new Error(`${ticket.id}.buyer.${field} debe ser texto.`);
    }
    if (!['pending', 'paid'].includes(ticket.buyer.paymentStatus)) {
      throw new Error(`${ticket.id}.buyer.paymentStatus no es valido.`);
    }
    if (!['admin', 'public'].includes(ticket.buyer.source)) {
      throw new Error(`${ticket.id}.buyer.source no es valido.`);
    }
  }

  return true;
}
