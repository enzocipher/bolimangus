export class AppError extends Error {
  constructor(message, { code = 'INTERNAL_ERROR', statusCode = 500, cause } = {}) {
    super(message, { cause });
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    Error.captureStackTrace?.(this, AppError);
  }
}

export function validationError(message) {
  return new AppError(message, { code: 'VALIDATION_ERROR', statusCode: 400 });
}

export function notFound(message = 'Recurso no encontrado.') {
  return new AppError(message, { code: 'NOT_FOUND', statusCode: 404 });
}

export function conflict(message = 'El recurso ya no esta disponible.') {
  return new AppError(message, { code: 'CONFLICT', statusCode: 409 });
}

export function isAppError(error) {
  return error instanceof AppError;
}
