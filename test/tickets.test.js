import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateTickets, TICKET_COUNT, validateTickets } from '../src/tickets.js';

function orderedDraw() {
  let pairIndex = 0;
  let firstCall = true;
  return () => {
    if (firstCall) {
      firstCall = false;
      return Math.floor(pairIndex / 53) + 1;
    }
    firstCall = true;
    const value = (pairIndex % 53) + 1;
    pairIndex += 1;
    return value;
  };
}

describe('tickets ordenados', () => {
  it('genera exactamente 106 pares ordenados unicos dentro de 1..53', () => {
    const tickets = generateTickets({ drawNumber: orderedDraw() });
    assert.equal(tickets.length, TICKET_COUNT);
    assert.equal(new Set(tickets.map((ticket) => `${ticket.first}:${ticket.second}`)).size, TICKET_COUNT);
    assert.equal(validateTickets(tickets), true);
    assert.deepEqual(tickets[0], { id: 'T001', first: 1, second: 1, buyer: null });
    assert.deepEqual(tickets[52], { id: 'T053', first: 1, second: 53, buyer: null });
    assert.deepEqual(tickets[53], { id: 'T054', first: 2, second: 1, buyer: null });
  });

  it('acepta valores iguales y considera distintos los pares invertidos', () => {
    const tickets = generateTickets({ drawNumber: orderedDraw() });
    assert.ok(tickets.some((ticket) => ticket.first === ticket.second));
    assert.ok(tickets.some((ticket) => ticket.first === 1 && ticket.second === 2));
    assert.ok(tickets.some((ticket) => ticket.first === 2 && ticket.second === 1));
    assert.doesNotThrow(() => validateTickets(tickets));
  });

  it('rechaza un par ordenado completo repetido', () => {
    const tickets = generateTickets({ drawNumber: orderedDraw() });
    tickets.at(-1).first = tickets[0].first;
    tickets.at(-1).second = tickets[0].second;
    assert.throws(() => validateTickets(tickets), /repetido/);
  });
});
