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
import { MAX_NUMBER, MIN_NUMBER, samePair } from './tickets.js';

function asyncHandler(handler) {
  return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
}

function prizeImageUrls(prize) {
  if (Array.isArray(prize.imageUrls)) return prize.imageUrls;
  return prize.imageUrl ? [prize.imageUrl] : [];
}

function setPrizeImageUrls(prize, imageUrls) {
  prize.imageUrls = imageUrls;
  delete prize.imageUrl;
}

function publicData(data) {
  return {
    raffle: data.raffle,
    prizes: data.prizes.map((prize) => ({
      id: prize.id,
      name: prize.name,
      description: prize.description,
      imageUrls: prizeImageUrls(prize),
    })),
    tickets: data.tickets.map((ticket) => ({
      first: ticket.first,
      second: ticket.second,
      buyer: {
        name: ticket.buyer.name,
        paymentStatus: ticket.buyer.paymentStatus,
      },
    })),
    updatedAt: data.updatedAt,
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
        imgSrc: ["'self'", 'data:', 'https://static.wikitide.net'],
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
      files: 3,
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

  const uploadPrizeImages = upload.fields([
    { name: 'images', maxCount: 3 },
    { name: 'image', maxCount: 1 },
  ]);

  function uploadedPrizeFiles(request) {
    if (!request.files || Array.isArray(request.files)) return [];
    return [...(request.files.images || []), ...(request.files.image || [])];
  }

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

  async function finalizeUploads(files) {
    const imageUrls = [];
    try {
      for (const file of files) imageUrls.push(await finalizeUpload(file));
      return imageUrls;
    } catch (error) {
      await Promise.all(imageUrls.map((imageUrl) => removeLocalImage(imageUrl, config.uploadDir).catch(() => undefined)));
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

  app.post('/api/public/tickets/register', requirePublicRequest, asyncHandler(async (request, response) => {
    const first = Number(request.body?.first);
    const second = Number(request.body?.second);
    if (!Number.isInteger(first) || !Number.isInteger(second)
      || first < MIN_NUMBER || first > MAX_NUMBER
      || second < MIN_NUMBER || second > MAX_NUMBER
      || first === second) {
      throw validationError(`Elige dos numeros distintos entre ${MIN_NUMBER} y ${MAX_NUMBER}.`);
    }
    const buyer = cleanPublicBuyer(request.body);

    const ticket = await store.update((data) => {
      if (data.tickets.some((item) => samePair(item, first, second))) {
        throw conflict('Ese par ya fue reservado, incluso en el orden inverso. Elige otro.');
      }
      const created = {
        id: `T-${randomUUID().slice(0, 8).toUpperCase()}`,
        first,
        second,
        buyer,
      };
      data.tickets.push(created);
      return created;
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
      const index = data.tickets.findIndex((item) => item.id === request.params.ticketId);
      if (index === -1) throw notFound('El ticket no existe.');
      const found = data.tickets[index];
      const input = request.body?.buyer;
      if (input === null) {
        data.tickets.splice(index, 1);
        return null;
      }
      found.buyer = cleanBuyer(input, {
        assignedAt: found.buyer?.assignedAt,
        defaultPaymentStatus: found.buyer?.paymentStatus || 'paid',
        source: found.buyer?.source || 'admin',
      });
      return found;
    });
    response.json({ ticket });
  }));

  app.post('/api/admin/prizes', requireAdmin, requireAdminRequest, uploadPrizeImages, asyncHandler(async (request, response) => {
    const prizeInput = cleanPrize(request.body);
    const files = uploadedPrizeFiles(request);
    if (files.length > 3) throw validationError('Cada premio puede tener como maximo 3 imagenes.');
    const imageUrls = await finalizeUploads(files);
    const prize = {
      id: `premio-${randomUUID()}`,
      ...prizeInput,
      imageUrls,
    };
    try {
      await store.update((data) => {
        if (data.prizes.length >= 20) throw validationError('No se pueden agregar mas de 20 premios.');
        data.prizes.push(prize);
      });
    } catch (error) {
      await Promise.all(imageUrls.map((imageUrl) => removeLocalImage(imageUrl, config.uploadDir).catch(() => undefined)));
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

  app.post('/api/admin/prizes/:prizeId/images', requireAdmin, requireAdminRequest, uploadPrizeImages, asyncHandler(async (request, response) => {
    const files = uploadedPrizeFiles(request);
    if (files.length === 0) throw validationError('Selecciona al menos una imagen.');
    if (files.length > 3) throw validationError('Cada premio puede tener como maximo 3 imagenes.');
    const imageUrls = await finalizeUploads(files);
    try {
      const prize = await store.update((data) => {
        const found = data.prizes.find((item) => item.id === request.params.prizeId);
        if (!found) throw notFound('El premio no existe.');
        const currentImageUrls = prizeImageUrls(found);
        if (currentImageUrls.length + imageUrls.length > 3) {
          throw validationError(`Este premio ya tiene ${currentImageUrls.length} imagen(es). Solo puede tener 3 en total.`);
        }
        setPrizeImageUrls(found, [...currentImageUrls, ...imageUrls]);
        return found;
      });
      response.json({ prize });
    } catch (error) {
      await Promise.all(imageUrls.map((imageUrl) => removeLocalImage(imageUrl, config.uploadDir).catch(() => undefined)));
      throw error;
    }
  }));

  app.delete('/api/admin/prizes/:prizeId/images/:filename', requireAdmin, requireAdminRequest, asyncHandler(async (request, response) => {
    const filename = request.params.filename;
    if (!filename || basename(filename) !== filename) throw validationError('La imagen indicada no es valida.');
    let removedImageUrl = null;
    const prize = await store.update((data) => {
      const found = data.prizes.find((item) => item.id === request.params.prizeId);
      if (!found) throw notFound('El premio no existe.');
      const imageUrls = prizeImageUrls(found);
      const index = imageUrls.findIndex((imageUrl) => basename(imageUrl) === filename);
      if (index === -1) throw notFound('La imagen no existe en este premio.');
      [removedImageUrl] = imageUrls.splice(index, 1);
      setPrizeImageUrls(found, imageUrls);
      return found;
    });
    await removeLocalImage(removedImageUrl, config.uploadDir).catch(() => undefined);
    response.json({ prize });
  }));

  app.delete('/api/admin/prizes/:prizeId', requireAdmin, requireAdminRequest, asyncHandler(async (request, response) => {
    let imageUrls = [];
    await store.update((data) => {
      const index = data.prizes.findIndex((item) => item.id === request.params.prizeId);
      if (index === -1) throw notFound('El premio no existe.');
      imageUrls = prizeImageUrls(data.prizes[index]);
      data.prizes.splice(index, 1);
    });
    await Promise.all(imageUrls.map((imageUrl) => removeLocalImage(imageUrl, config.uploadDir).catch(() => undefined)));
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
    response.setHeader('Cache-Control', 'no-cache');
    response.sendFile(join(config.publicDir, 'index.html'));
  });

  app.get(['/1', '/1/', '/2', '/2/'], (request, response) => {
    response.redirect(302, '/');
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
    const temporaryFiles = request.file
      ? [request.file]
      : request.files && !Array.isArray(request.files)
        ? Object.values(request.files).flat()
        : Array.isArray(request.files)
          ? request.files
          : [];
    for (const file of temporaryFiles) {
      if (file?.path) rm(file.path, { force: true }).catch(() => undefined);
    }

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
