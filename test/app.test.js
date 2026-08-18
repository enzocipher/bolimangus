import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createApp } from '../src/app.js';
import { createPasswordHash } from '../src/auth.js';

describe('API de la rifa dinamica', () => {
  let directory;
  let server;
  let baseUrl;
  let cookie;
  let reservedTicket;

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

  it('publica una lista segura de tickets sin campos privados ni contador separado', async () => {
    const response = await fetch(`${baseUrl}/api/public`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.deepEqual(payload.tickets, []);
    assert.equal('ticketCount' in payload, false);
    assert.equal('totalTickets' in payload, false);
    assert.ok(payload.raffle);
    assert.ok(Array.isArray(payload.prizes));
  });

  it('protege el panel, inicia sesion y exige cabecera administrativa', async () => {
    assert.equal((await fetch(`${baseUrl}/api/admin/data`)).status, 401);
    const login = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'clave-de-prueba-segura' }),
    });
    assert.equal(login.status, 200);
    cookie = login.headers.get('set-cookie').split(';')[0];
    const blockedMutation = await fetch(`${baseUrl}/api/admin/tickets/inexistente`, {
      method: 'PATCH',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ buyer: null }),
    });
    assert.equal(blockedMutation.status, 403);
  });

  it('crea el par elegido y bloquea simultaneamente su orden inverso', async () => {
    const body = { first: 12, second: 1, name: 'Reserva desde web', phone: '987 111 222', paymentStatus: 'paid' };
    const attempts = await Promise.all([
      fetch(`${baseUrl}/api/public/tickets/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Rifa-Public': '1' },
        body: JSON.stringify(body),
      }),
      fetch(`${baseUrl}/api/public/tickets/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Rifa-Public': '1' },
        body: JSON.stringify({ ...body, first: 1, second: 12, name: 'Intento inverso' }),
      }),
    ]);
    assert.deepEqual(attempts.map((response) => response.status).sort(), [201, 409]);

    const adminData = await (await fetch(`${baseUrl}/api/admin/data`, { headers: { Cookie: cookie } })).json();
    assert.equal(adminData.tickets.length, 1);
    reservedTicket = adminData.tickets[0];
    assert.ok(['Reserva desde web', 'Intento inverso'].includes(reservedTicket.buyer.name));
    assert.equal(reservedTicket.buyer.phone, '987 111 222');
    assert.equal(reservedTicket.buyer.source, 'public');
    assert.equal(reservedTicket.buyer.paymentStatus, 'pending');

    const publicData = await (await fetch(`${baseUrl}/api/public`)).json();
    assert.equal(publicData.tickets.length, 1);
    assert.deepEqual(publicData.tickets[0], {
      first: reservedTicket.first,
      second: reservedTicket.second,
      buyer: {
        name: reservedTicket.buyer.name,
        paymentStatus: 'pending',
      },
    });
  });

  it('rechaza pares iguales, fuera de rango y solicitudes publicas sin cabecera', async () => {
    const headers = { 'Content-Type': 'application/json', 'X-Rifa-Public': '1' };
    const base = { name: 'Persona', phone: '999999999' };
    const same = await fetch(`${baseUrl}/api/public/tickets/register`, {
      method: 'POST', headers, body: JSON.stringify({ ...base, first: 25, second: 25 }),
    });
    const outside = await fetch(`${baseUrl}/api/public/tickets/register`, {
      method: 'POST', headers, body: JSON.stringify({ ...base, first: 0, second: 54 }),
    });
    const noHeader = await fetch(`${baseUrl}/api/public/tickets/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...base, first: 2, second: 3 }),
    });
    assert.equal(same.status, 400);
    assert.equal(outside.status, 400);
    assert.equal(noHeader.status, 403);
  });

  it('permite al admin confirmar pago sin cambiar el par', async () => {
    const updated = await fetch(`${baseUrl}/api/admin/tickets/${reservedTicket.id}`, {
      method: 'PATCH',
      headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-Rifa-Admin': '1' },
      body: JSON.stringify({ buyer: { ...reservedTicket.buyer, paymentStatus: 'paid', name: 'Pago confirmado' } }),
    });
    assert.equal(updated.status, 200);
    const ticket = (await updated.json()).ticket;
    assert.deepEqual([ticket.first, ticket.second], [12, 1]);
    assert.equal(ticket.buyer.paymentStatus, 'paid');
    assert.equal(ticket.buyer.source, 'public');
  });

  it('elimina el ticket al retirar al participante y permite elegir el par otra vez', async () => {
    const released = await fetch(`${baseUrl}/api/admin/tickets/${reservedTicket.id}`, {
      method: 'PATCH',
      headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-Rifa-Admin': '1' },
      body: JSON.stringify({ buyer: null }),
    });
    assert.equal(released.status, 200);
    assert.equal((await (await fetch(`${baseUrl}/api/admin/data`, { headers: { Cookie: cookie } })).json()).tickets.length, 0);

    const reused = await fetch(`${baseUrl}/api/public/tickets/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Rifa-Public': '1' },
      body: JSON.stringify({ first: 1, second: 12, name: 'Nueva reserva', phone: '988888888' }),
    });
    assert.equal(reused.status, 201);
  });

  it('acepta una imagen valida y rechaza contenido que solo finge ser PNG', async () => {
    const validPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    const validForm = new FormData();
    validForm.append('name', 'Premio con imagen');
    validForm.append('description', 'Imagen de prueba');
    validForm.append('image', new Blob([validPng], { type: 'image/png' }), 'premio.png');
    const created = await fetch(`${baseUrl}/api/admin/prizes`, {
      method: 'POST', headers: { Cookie: cookie, 'X-Rifa-Admin': '1' }, body: validForm,
    });
    assert.equal(created.status, 201);
    assert.match((await created.json()).prize.imageUrl, /^\/uploads\/[a-f0-9-]+\.png$/);

    const fakeForm = new FormData();
    fakeForm.append('name', 'Archivo falso');
    fakeForm.append('description', 'No debe guardarse');
    fakeForm.append('image', new Blob(['esto no es una imagen'], { type: 'image/png' }), 'falso.png');
    const rejected = await fetch(`${baseUrl}/api/admin/prizes`, {
      method: 'POST', headers: { Cookie: cookie, 'X-Rifa-Admin': '1' }, body: fakeForm,
    });
    assert.equal(rejected.status, 400);
  });

  it('sirve una sola pagina publica y conserva las rutas antiguas como redirecciones', async () => {
    const home = await fetch(`${baseUrl}/`);
    const firstPage = await fetch(`${baseUrl}/1`, { redirect: 'manual' });
    const secondPage = await fetch(`${baseUrl}/2/`, { redirect: 'manual' });
    const admin = await fetch(`${baseUrl}/admin`);
    const favicon = await fetch(`${baseUrl}/favicon.svg`);
    assert.equal(home.status, 200);
    assert.equal(firstPage.status, 302);
    assert.equal(firstPage.headers.get('location'), '/');
    assert.equal(secondPage.status, 302);
    assert.equal(secondPage.headers.get('location'), '/');
    assert.equal(admin.status, 200);
    assert.equal(favicon.status, 200);
    assert.match(favicon.headers.get('content-type'), /image\/svg\+xml/);
    const html = await home.text();
    assert.match(html, /Elige tus dos números/);
    assert.match(html, /Primer premio/);
    assert.match(html, /Segundo premio/);
    assert.match(html, /Tickets elegidos/);
    assert.match(html, /id="mart-cursor"/);
    assert.match(html, /data-doron-signature="Doron::MartKeeper::v1"/);
    assert.match(html, /src="https:\/\/static\.wikitide\.net\/nullscapewiki\/9\/90\/Probably_Improper_Speeded_Mart\.gif"/);
    assert.match(html, /meta name="author" content="Doron"/);
    assert.doesNotMatch(html, /Tickets totales|tickets encontrados|53 tickets|106 pares/);
    const publicScript = await (await fetch(`${baseUrl}/app.js`)).text();
    assert.match(publicScript, /DORON_MART_SIGNATURE = 'Doron::MartKeeper::v1'/);
    assert.match(publicScript, /lockPublicPageForMart/);
    const adminHtml = await admin.text();
    assert.match(adminHtml, /Verificar ganadores de la Tinka/);
    assert.equal(home.headers.get('x-content-type-options'), 'nosniff');
    assert.match(home.headers.get('content-security-policy'), /img-src 'self' data: https:\/\/static\.wikitide\.net/);
  });
});
