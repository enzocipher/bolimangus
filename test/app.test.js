import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createApp } from '../src/app.js';
import { createPasswordHash } from '../src/auth.js';

describe('API de la rifa', () => {
  let directory;
  let server;
  let baseUrl;
  let cookie;

  before(async () => {
    directory = await mkdtemp(join(tmpdir(), 'rifa-app-'));
    const config = {
      host: '127.0.0.1',
      port: 0,
      adminPasswordHash: await createPasswordHash('clave-de-prueba-segura'),
      sessionSecret: 'x'.repeat(64),
      cookieSecure: false,
      httpsOnly: false,
      dataFile: join(directory, 'data', 'rifa.json'),
      uploadDir: join(directory, 'uploads'),
      tempUploadDir: join(directory, 'temp-uploads'),
      publicDir: resolve('public'),
      sessionMaxAgeMs: 60_000,
      maxImageBytes: 5 * 1024 * 1024,
    };
    const created = await createApp({ config });
    server = created.app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (server) await new Promise((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()));
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it('publica 106 tickets sin datos privados del comprador', async () => {
    const response = await fetch(`${baseUrl}/api/public`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.tickets.length, 106);
  });

  it('publica dos vistas aisladas de 53 tickets sin identificadores globales', async () => {
    const [firstResponse, secondResponse] = await Promise.all([
      fetch(`${baseUrl}/api/public/1`),
      fetch(`${baseUrl}/api/public/2`),
    ]);
    assert.equal(firstResponse.status, 200);
    assert.equal(secondResponse.status, 200);
    const first = await firstResponse.json();
    const second = await secondResponse.json();
    assert.equal(first.tickets.length, 53);
    assert.equal(second.tickets.length, 53);
    assert.equal('id' in first.tickets[0], false);
    assert.equal('id' in second.tickets[0], false);
    assert.notDeepEqual(
      [first.tickets[0].first, first.tickets[0].second],
      [second.tickets[0].first, second.tickets[0].second],
    );
  });

  it('protege el panel, inicia sesion y exige cabecera administrativa', async () => {
    const unauthorized = await fetch(`${baseUrl}/api/admin/data`);
    assert.equal(unauthorized.status, 401);

    const login = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'clave-de-prueba-segura' }),
    });
    assert.equal(login.status, 200);
    cookie = login.headers.get('set-cookie').split(';')[0];

    const blockedMutation = await fetch(`${baseUrl}/api/admin/tickets/T001`, {
      method: 'PATCH',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ buyer: null }),
    });
    assert.equal(blockedMutation.status, 403);
  });

  it('asigna comprador sin alterar el par y oculta telefono y notas en la API publica', async () => {
    const beforeResponse = await fetch(`${baseUrl}/api/admin/data`, { headers: { Cookie: cookie } });
    const beforeData = await beforeResponse.json();
    const beforeTicket = beforeData.tickets[0];

    const updated = await fetch(`${baseUrl}/api/admin/tickets/T001`, {
      method: 'PATCH',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
        'X-Rifa-Admin': '1',
      },
      body: JSON.stringify({
        buyer: { name: 'Persona publica', phone: '987654321', notes: 'Nota privada' },
      }),
    });
    assert.equal(updated.status, 200);
    const updatedPayload = await updated.json();
    assert.deepEqual(
      [updatedPayload.ticket.first, updatedPayload.ticket.second],
      [beforeTicket.first, beforeTicket.second],
    );

    const publicResponse = await fetch(`${baseUrl}/api/public`);
    const publicTicket = (await publicResponse.json()).tickets[0];
    assert.deepEqual(publicTicket.buyer, { name: 'Persona publica', paymentStatus: 'paid' });
    assert.equal('phone' in publicTicket.buyer, false);
    assert.equal('notes' in publicTicket.buyer, false);
  });

  it('permite una sola inscripcion publica, protege el telefono y deja el pago pendiente', async () => {
    const pageResponse = await fetch(`${baseUrl}/api/public/1`);
    const pageData = await pageResponse.json();
    const candidate = pageData.tickets.find((ticket) => !ticket.buyer);
    const registrationBody = {
      first: candidate.first,
      second: candidate.second,
      name: 'Reserva desde web',
      phone: '987 111 222',
      paymentStatus: 'paid',
    };

    const missingHeader = await fetch(`${baseUrl}/api/public/1/tickets/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registrationBody),
    });
    assert.equal(missingHeader.status, 403);

    const attempts = await Promise.all([
      fetch(`${baseUrl}/api/public/1/tickets/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Rifa-Public': '1' },
        body: JSON.stringify(registrationBody),
      }),
      fetch(`${baseUrl}/api/public/1/tickets/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Rifa-Public': '1' },
        body: JSON.stringify({ ...registrationBody, name: 'Intento duplicado' }),
      }),
    ]);
    assert.deepEqual(attempts.map((response) => response.status).sort(), [201, 409]);

    const publicAfter = await (await fetch(`${baseUrl}/api/public/1`)).json();
    const publicTicket = publicAfter.tickets.find((ticket) => ticket.first === candidate.first && ticket.second === candidate.second);
    assert.equal(publicTicket.buyer.paymentStatus, 'pending');
    assert.equal('phone' in publicTicket.buyer, false);

    const adminData = await (await fetch(`${baseUrl}/api/admin/data`, { headers: { Cookie: cookie } })).json();
    const adminTicket = adminData.tickets.find((ticket) => ticket.first === candidate.first && ticket.second === candidate.second);
    assert.equal(adminTicket.buyer.phone, '987 111 222');
    assert.equal(adminTicket.buyer.source, 'public');
    assert.equal(adminTicket.buyer.paymentStatus, 'pending');

    const paid = await fetch(`${baseUrl}/api/admin/tickets/${adminTicket.id}`, {
      method: 'PATCH',
      headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-Rifa-Admin': '1' },
      body: JSON.stringify({ buyer: { ...adminTicket.buyer, paymentStatus: 'paid' } }),
    });
    assert.equal(paid.status, 200);
    const paidPublic = await (await fetch(`${baseUrl}/api/public/1`)).json();
    assert.equal(
      paidPublic.tickets.find((ticket) => ticket.first === candidate.first && ticket.second === candidate.second).buyer.paymentStatus,
      'paid',
    );

    const released = await fetch(`${baseUrl}/api/admin/tickets/${adminTicket.id}`, {
      method: 'PATCH',
      headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-Rifa-Admin': '1' },
      body: JSON.stringify({ buyer: null }),
    });
    assert.equal(released.status, 200);
    const releasedPublic = await (await fetch(`${baseUrl}/api/public/1`)).json();
    assert.equal(
      releasedPublic.tickets.find((ticket) => ticket.first === candidate.first && ticket.second === candidate.second).buyer,
      null,
    );
  });

  it('impide inscribir desde una vista un ticket perteneciente a la otra', async () => {
    const firstPage = await (await fetch(`${baseUrl}/api/public/1`)).json();
    const candidate = firstPage.tickets.find((ticket) => !ticket.buyer);
    const response = await fetch(`${baseUrl}/api/public/2/tickets/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Rifa-Public': '1' },
      body: JSON.stringify({
        first: candidate.first,
        second: candidate.second,
        name: 'Vista incorrecta',
        phone: '999999999',
      }),
    });
    assert.equal(response.status, 404);
  });

  it('acepta una imagen valida y rechaza contenido que solo finge ser PNG', async () => {
    const validPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    const validForm = new FormData();
    validForm.append('name', 'Premio con imagen');
    validForm.append('description', 'Imagen de prueba');
    validForm.append('image', new Blob([validPng], { type: 'image/png' }), 'premio.png');
    const created = await fetch(`${baseUrl}/api/admin/prizes`, {
      method: 'POST',
      headers: { Cookie: cookie, 'X-Rifa-Admin': '1' },
      body: validForm,
    });
    assert.equal(created.status, 201);
    const createdPrize = (await created.json()).prize;
    assert.match(createdPrize.imageUrl, /^\/uploads\/[a-f0-9-]+\.png$/);

    const fakeForm = new FormData();
    fakeForm.append('name', 'Archivo falso');
    fakeForm.append('description', 'No debe guardarse');
    fakeForm.append('image', new Blob(['esto no es una imagen'], { type: 'image/png' }), 'falso.png');
    const rejected = await fetch(`${baseUrl}/api/admin/prizes`, {
      method: 'POST',
      headers: { Cookie: cookie, 'X-Rifa-Admin': '1' },
      body: fakeForm,
    });
    assert.equal(rejected.status, 400);
    assert.match((await rejected.json()).error.message, /PNG, JPEG o WebP valido/);
  });

  it('sirve la pagina publica y el panel con encabezados de seguridad', async () => {
    const [home, firstPage, secondPage, admin] = await Promise.all([
      fetch(`${baseUrl}/`),
      fetch(`${baseUrl}/1`),
      fetch(`${baseUrl}/2/`),
      fetch(`${baseUrl}/admin`),
    ]);
    assert.equal(home.status, 200);
    assert.equal(new URL(home.url).pathname, '/1');
    assert.equal(firstPage.status, 200);
    assert.equal(secondPage.status, 200);
    assert.equal(admin.status, 200);
    const contentSecurityPolicy = home.headers.get('content-security-policy');
    assert.match(contentSecurityPolicy, /default-src 'self'/);
    assert.doesNotMatch(contentSecurityPolicy, /upgrade-insecure-requests/);
    assert.equal(home.headers.get('x-content-type-options'), 'nosniff');
    const homeHtml = await home.text();
    assert.match(homeHtml, /Tickets y participantes/);
    assert.match(homeHtml, /Inscríbete en este ticket/);
    assert.match(homeHtml, /Sorteo activo · 53 tickets/);
    assert.match(homeHtml, /Modalidad del sorteo/);
    assert.match(homeHtml, /Primer premio/);
    assert.match(homeHtml, /Segundo premio/);
    const secondPageHtml = await secondPage.text();
    assert.match(secondPageHtml, /Primer premio/);
    assert.match(secondPageHtml, /Segundo premio/);
    assert.doesNotMatch(homeHtml, /53 oportunidades/);
    assert.match(await admin.text(), /Administración/);
  });
});
