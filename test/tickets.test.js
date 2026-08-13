import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateTickets, TICKET_COUNT, validateTickets } from '../src/tickets.js';

const keepOrder = (minimum) => minimum;

describe('tickets sin pares repetidos', () => {
  it('genera exactamente 106 pares distintos y no dirigidos dentro de 1..53', () => {
    const tickets = generateTickets({ drawNumber: keepOrder });
    assert.equal(tickets.length, TICKET_COUNT);
    assert.equal(new Set(tickets.map((ticket) => `${Math.min(ticket.first, ticket.second)}:${Math.max(ticket.first, ticket.second)}`)).size, TICKET_COUNT);
    assert.equal(validateTickets(tickets), true);
    assert.ok(tickets.every((ticket) => ticket.first !== ticket.second));
  });

  it('rechaza un ticket con dos numeros iguales', () => {
    const tickets = generateTickets({ drawNumber: keepOrder });
    tickets[0].second = tickets[0].first;
    assert.throws(() => validateTickets(tickets), /dos numeros distintos/);
  });

  it('rechaza un par repetido en el mismo orden', () => {
    const tickets = generateTickets({ drawNumber: keepOrder });
    tickets.at(-1).first = tickets[0].first;
    tickets.at(-1).second = tickets[0].second;
    assert.throws(() => validateTickets(tickets), /repetido/);
  });

  it('rechaza un par repetido en orden inverso', () => {
    const tickets = generateTickets({ drawNumber: keepOrder });
    tickets.at(-1).first = tickets[0].second;
    tickets.at(-1).second = tickets[0].first;
    assert.throws(() => validateTickets(tickets), /orden inverso/);
  });
});
