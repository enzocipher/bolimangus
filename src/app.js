import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import { mkdir, open, rename, rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { conflict, isAppError, notFound, validationError } from './errors.js';
import { JsonStore } from './store.js';
import {
  COOKIE_NAME,
  createLoginLimiter,
  createSessionToken,
  expiredSessionCookie,
  parseCookies,
  sessionCookie,
  verifyPassword,
  verifySessionToken,
} from './auth.js';
import { cleanBuyer, cleanPrize, cleanPublicBuyer, cleanRaffleSettings } from './validation.js';

function asyncHandler(handler) {
  return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
}

function publicData(data) {
  return {
    raffle: data.raffle,
    prizes: data.prizes,
    tickets: data.tickets.map((ticket) => ({
      id: ticket.id,
      first: ticket.first,
      second: ticket.second,
      buyer: ticket.buyer ? {
        name: ticket.buyer.name,
        paymentStatus: ticket.buyer.paymentStatus || 'paid',
      } : null,
    })),
    updatedAt: data.updatedAt,
  };
}

function publicPageData(data, page) {
  const result = publicData(data);
  const start = (page - 1) * 53;
  return {
    ...result,
    tickets: result.tickets.slice(start, start + 53).map(({ id, ...ticket }) => ticket),
  };
}

async function detectImageType(filePath) {
  const handle = await open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(12);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return { extension: '.png', mime: 'image/png' };
    }
    if (bytesRead >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { extension: '.jpg', mime: 'image/jpeg' };
    }
    if (bytesRead >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
      return { extension: '.webp', mime: 'image/webp' };
    }
    throw validationError('La imagen debe ser un archivo PNG, JPEG o WebP valido.');
  } finally {
    await handle.close();
  }
}

function localImagePath(imageUrl, uploadDir) {
  if (typeof imageUrl !== 'string' || !imageUrl.startsWith('/uploads/')) return null;
  const filename = basename(imageUrl);
  if (!filename || filename !== imageUrl.slice('/uploads/'.length)) return null;
  return join(uploadDir, filename);
}

async function removeLocalImage(imageUrl, uploadDir) {
  const path = localImagePath(imageUrl, uploadDir);
  if (path) await rm(path, { force: true });
}

export async function createApp({ config, store = new JsonStore(config.dataFile) }) {
  await Promise.all([
    mkdir(config.uploadDir, { recursive: true }),
    mkdir(config.tempUploadDir, { recursive: true }),
    store.init(),
  ]);

  const app = express();
  const loginLimiter = createLoginLimiter();
  app.locals.isShuttingDown = false;
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');

  app.use((request, response, next) => {
    request.id = randomUUID();
    response.setHeader('X-Request-Id', request.id);
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    const startedAt = performance.now();
    response.on('finish', () => {
      const duration = Math.round(performance.now() - startedAt);
      console.info(JSON.stringify({
        level: 'info',
        requestId: request.id,
        method: request.method,
        path: request.path,
        status: response.statusCode,
        durationMs: duration,
      }));
    });
    next();
  });

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: config.httpsOnly ? [] : null,
      },
    },
    strictTransportSecurity: config.httpsOnly
      ? { maxAge: 31_536_000, includeSubDomains: true }
      : false,
    referrerPolicy: { policy: 'no-referrer' },
  }));

  app.use(express.json({ limit: '32kb', strict: true }));
  app.use(express.urlencoded({ extended: false, limit: '32kb' }));

  const upload = multer({
    dest: config.tempUploadDir,
    limits: {
      fileSize: config.maxImageBytes,
      files: 1,
      fields: 4,
      fieldSize: 4_096,
    },
    fileFilter(_request, file, callback) {
      const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
      if (!allowed.has(file.mimetype)) {
        callback(validationError('La imagen debe ser PNG, JPEG o WebP.'));
        return;
      }
      callback(null, true);
    },
  });

  async function finalizeUpload(file) {
    if (!file) return null;
    try {
      const detected = await detectImageType(file.path);
      const filename = `${randomUUID()}${detected.extension}`;
      const destination = join(config.uploadDir, filename);
      await rename(file.path, destination);
      return `/uploads/${filename}`;
    } catch (error) {
      await rm(file.path, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  function requireAdmin(request, response, next) {
    const token = parseCookies(request.headers.cookie)[COOKIE_NAME];
    if (!verifySessionToken(token, config.sessionSecret)) {
      response.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Inicia sesion para continuar.' } });
      return;
    }
    next();
  }

  function requireAdminRequest(request, response, next) {
    if (request.get('X-Rifa-Admin') !== '1') {
      response.status(403).json({ error: { code: 'INVALID_REQUEST', message: 'Solicitud administrativa invalida.' } });
      return;
    }
    next();
  }

  function requirePublicRequest(request, response, next) {
    if (request.get('X-Rifa-Public') !== '1') {
      response.status(403).json({ error: { code: 'INVALID_REQUEST', message: 'Solicitud publica invalida.' } });
      return;
    }
    next();
  }

  app.get('/health', (request, response) => {
    if (app.locals.isShuttingDown) {
      response.status(503).json({ status: 'shutting_down' });
      return;
    }
    response.json({ status: 'ok' });
  });

  app.get('/api/public', (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.json(publicData(store.getData()));
  });

  app.get('/api/public/:page', (request, response) => {
    const page = Number(request.params.page);
    if (page !== 1 && page !== 2) {
      response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ruta no encontrada.' } });
      return;
    }
    response.setHeader('Cache-Control', 'no-store');
    response.json(publicPageData(store.getData(), page));
  });

  app.post('/api/public/:page/tickets/register', requirePublicRequest, asyncHandler(async (request, response) => {
    const page = Number(request.params.page);
    if (page !== 1 && page !== 2) throw notFound('La vista de tickets no existe.');

    const first = Number(request.body?.first);
    const second = Number(request.body?.second);
    if (!Number.isInteger(first) || !Number.isInteger(second)
      || first < 1 || first > 53 || second < 1 || second > 53 || first === second) {
      throw validationError('El par de numeros enviado no es valido.');
    }
    const buyer = cleanPublicBuyer(request.body);

    const ticket = await store.update((data) => {
      const start = (page - 1) * 53;
      const pageTickets = data.tickets.slice(start, start + 53);
      const found = pageTickets.find((item) => (
        (item.first === first && item.second === second)
        || (item.first === second && item.second === first)
      ));
      if (!found) throw notFound('Ese ticket no pertenece a esta vista de la rifa.');
      if (found.buyer) throw conflict('Ese ticket acaba de ser reservado. Elige otro disponible.');
      found.buyer = buyer;
      return found;
    });

    response.status(201).json({
      ticket: {
        first: ticket.first,
        second: ticket.second,
        buyer: { name: ticket.buyer.name, paymentStatus: ticket.buyer.paymentStatus },
      },
    });
  }));

  app.post('/api/admin/login', asyncHandler(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    const key = request.ip || request.socket.remoteAddress || 'unknown';
    if (!loginLimiter.canAttempt(key)) {
      response.status(429).json({ error: { code: 'TOO_MANY_ATTEMPTS', message: 'Demasiados intentos. Espera 15 minutos.' } });
      return;
    }

    const password = request.body?.password;
    if (!(await verifyPassword(password, config.adminPasswordHash))) {
      loginLimiter.recordFailure(key);
      response.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Contrasena incorrecta.' } });
      return;
    }

    loginLimiter.clear(key);
    const token = createSessionToken(config.sessionSecret, config.sessionMaxAgeMs);
    response.setHeader('Set-Cookie', sessionCookie(token, {
      secure: config.cookieSecure,
      maxAgeMs: config.sessionMaxAgeMs,
    }));
    response.json({ authenticated: true });
  }));

  app.get('/api/admin/session', requireAdmin, (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.json({ authenticated: true });
  });

  app.post('/api/admin/logout', requireAdmin, requireAdminRequest, (request, response) => {
    response.setHeader('Set-Cookie', expiredSessionCookie({ secure: config.cookieSecure }));
    response.status(204).send();
  });

  app.get('/api/admin/data', requireAdmin, (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.json(store.getData());
  });

  app.patch('/api/admin/raffle', requireAdmin, requireAdminRequest, asyncHandler(async (request, response) => {
    const raffle = cleanRaffleSettings(request.body);
    await store.update((data) => {
      data.raffle = raffle;
    });
    response.json({ raffle });
  }));

  app.patch('/api/admin/tickets/:ticketId', requireAdmin, requireAdminRequest, asyncHandler(async (request, response) => {
    const ticket = await store.update((data) => {
      const found = data.tickets.find((item) => item.id === request.params.ticketId);
      if (!found) throw notFound('El ticket no existe.');
      const input = request.body?.buyer;
      found.buyer = input === null ? null : cleanBuyer(input, {
        assignedAt: found.buyer?.assignedAt,
        defaultPaymentStatus: found.buyer?.paymentStatus || 'paid',
        source: found.buyer?.source || 'admin',
      });
      return found;
    });
    response.json({ ticket });
  }));

  app.post('/api/admin/prizes', requireAdmin, requireAdminRequest, upload.single('image'), asyncHandler(async (request, response) => {
    const prizeInput = cleanPrize(request.body);
    const imageUrl = await finalizeUpload(request.file);
    const prize = {
      id: `premio-${randomUUID()}`,
      ...prizeInput,
      imageUrl,
    };
    try {
      await store.update((data) => {
        if (data.prizes.length >= 20) throw validationError('No se pueden agregar mas de 20 premios.');
        data.prizes.push(prize);
      });
    } catch (error) {
      await removeLocalImage(imageUrl, config.uploadDir).catch(() => undefined);
      throw error;
    }
    response.status(201).json({ prize });
  }));

  app.patch('/api/admin/prizes/:prizeId', requireAdmin, requireAdminRequest, asyncHandler(async (request, response) => {
    const prizeInput = cleanPrize(request.body);
    const prize = await store.update((data) => {
      const found = data.prizes.find((item) => item.id === request.params.prizeId);
      if (!found) throw notFound('El premio no existe.');
      found.name = prizeInput.name;
      found.description = prizeInput.description;
      return found;
    });
    response.json({ prize });
  }));

  app.post('/api/admin/prizes/:prizeId/image', requireAdmin, requireAdminRequest, upload.single('image'), asyncHandler(async (request, response) => {
    if (!request.file) throw validationError('Selecciona una imagen.');
    const imageUrl = await finalizeUpload(request.file);
    let previousImageUrl = null;
    try {
      const prize = await store.update((data) => {
        const found = data.prizes.find((item) => item.id === request.params.prizeId);
        if (!found) throw notFound('El premio no existe.');
        previousImageUrl = found.imageUrl;
        found.imageUrl = imageUrl;
        return found;
      });
      await removeLocalImage(previousImageUrl, config.uploadDir).catch(() => undefined);
      response.json({ prize });
    } catch (error) {
      await removeLocalImage(imageUrl, config.uploadDir).catch(() => undefined);
      throw error;
    }
  }));

  app.delete('/api/admin/prizes/:prizeId', requireAdmin, requireAdminRequest, asyncHandler(async (request, response) => {
    let imageUrl = null;
    await store.update((data) => {
      const index = data.prizes.findIndex((item) => item.id === request.params.prizeId);
      if (index === -1) throw notFound('El premio no existe.');
      imageUrl = data.prizes[index].imageUrl;
      data.prizes.splice(index, 1);
    });
    await removeLocalImage(imageUrl, config.uploadDir).catch(() => undefined);
    response.status(204).send();
  }));

  app.use('/uploads', express.static(config.uploadDir, {
    dotfiles: 'deny',
    etag: true,
    fallthrough: false,
    immutable: false,
    maxAge: '1h',
  }));

  app.get('/', (request, response) => {
    response.redirect(302, '/1');
  });

  app.get(['/1', '/1/', '/2', '/2/'], (request, response) => {
    response.setHeader('Cache-Control', 'no-cache');
    response.sendFile(join(config.publicDir, 'index.html'));
  });

  app.get(['/admin', '/admin/'], (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.sendFile(join(config.publicDir, 'admin', 'index.html'));
  });

  app.use(express.static(config.publicDir, {
    dotfiles: 'deny',
    etag: true,
    index: false,
    maxAge: '1h',
  }));

  app.use((request, response) => {
    if (request.path.startsWith('/api/')) {
      response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ruta no encontrada.' } });
      return;
    }
    response.status(404).type('text/plain').send('Pagina no encontrada.');
  });

  app.use((error, request, response, _next) => {
    if (request.file?.path) rm(request.file.path, { force: true }).catch(() => undefined);

    let normalized = error;
    if (error instanceof multer.MulterError) {
      const message = error.code === 'LIMIT_FILE_SIZE'
        ? 'La imagen supera el limite de 5 MB.'
        : 'No se pudo procesar la imagen enviada.';
      normalized = validationError(message);
    } else if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
      normalized = validationError('El contenido JSON no es valido.');
    }

    const reportedStatus = Number(normalized?.statusCode ?? normalized?.status);
    const statusCode = isAppError(normalized)
      ? normalized.statusCode
      : reportedStatus >= 400 && reportedStatus < 500
        ? reportedStatus
        : 500;
    const code = isAppError(normalized)
      ? normalized.code
      : statusCode === 404
        ? 'NOT_FOUND'
        : 'INTERNAL_ERROR';
    const message = statusCode >= 500
      ? 'Ocurrio un error interno.'
      : isAppError(normalized)
        ? normalized.message
        : 'Recurso no encontrado.';

    console.error(JSON.stringify({
      level: 'error',
      requestId: request.id,
      code,
      message: normalized.message,
      stack: normalized.stack,
    }));

    response.status(statusCode).json({
      error: { code, message, requestId: request.id },
    });
  });

  return { app, store };
}
