import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pairKey, samePair, validatePair, validateTickets } from '../src/tickets.js';

function buyer(name = 'Participante') {
  return {
    name,
    phone: '999999999',
    notes: '',
    paymentStatus: 'pending',
    source: 'public',
    assignedAt: new Date().toISOString(),
  };
}

function ticket(id, first, second) {
  return { id, first, second, buyer: buyer() };
}

describe('tickets dinamicos con pares unicos', () => {
  it('acepta una lista vacia y cualquier cantidad valida de reservas', () => {
    assert.equal(validateTickets([]), true);
    assert.equal(validateTickets([ticket('A', 1, 2), ticket('B', 3, 53)]), true);
  });

  it('normaliza el par para comparar ambos ordenes', () => {
    assert.equal(pairKey(12, 1), pairKey(1, 12));
    assert.equal(samePair(ticket('A', 12, 1), 1, 12), true);
  });

  it('rechaza numeros iguales o fuera de 1..53', () => {
    assert.throws(() => validatePair(25, 25), /dos numeros distintos/);
    assert.throws(() => validatePair(0, 12), /entre 1 y 53/);
    assert.throws(() => validatePair(12, 54), /entre 1 y 53/);
  });

  it('rechaza pares repetidos incluso en orden inverso', () => {
    assert.throws(() => validateTickets([ticket('A', 12, 1), ticket('B', 1, 12)]), /orden inverso/);
  });

  it('rechaza identificadores repetidos y tickets sin comprador', () => {
    assert.throws(() => validateTickets([ticket('A', 1, 2), ticket('A', 3, 4)]), /identificador/);
    assert.throws(() => validateTickets([{ ...ticket('A', 1, 2), buyer: null }]), /comprador invalido/);
  });
});
