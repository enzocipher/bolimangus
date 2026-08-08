import { validationError } from './errors.js';

export function cleanString(value, field, { maximum = 200, required = false } = {}) {
  if (value === null || value === undefined) {
    if (required) throw validationError(`${field} es obligatorio.`);
    return '';
  }
  if (typeof value !== 'string') throw validationError(`${field} debe ser texto.`);
  const cleaned = value.trim();
  if (required && cleaned.length === 0) throw validationError(`${field} es obligatorio.`);
  if (cleaned.length > maximum) throw validationError(`${field} supera el maximo de ${maximum} caracteres.`);
  return cleaned;
}

export function cleanRaffleSettings(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw validationError('La configuracion enviada no es valida.');
  }
  const contact = input.contact && typeof input.contact === 'object' ? input.contact : {};
  return {
    title: cleanString(input.title, 'Titulo', { maximum: 80, required: true }),
    subtitle: cleanString(input.subtitle, 'Subtitulo', { maximum: 120 }),
    description: cleanString(input.description, 'Descripcion', { maximum: 800 }),
    drawDate: cleanString(input.drawDate, 'Fecha del sorteo', { maximum: 80 }),
    ticketPrice: cleanString(input.ticketPrice, 'Precio', { maximum: 40 }),
    currency: cleanString(input.currency, 'Moneda', { maximum: 10 }),
    terms: cleanString(input.terms, 'Condiciones', { maximum: 1_500 }),
    contact: {
      whatsapp: cleanString(contact.whatsapp, 'WhatsApp', { maximum: 30 }),
      phone: cleanString(contact.phone, 'Telefono', { maximum: 30 }),
      email: cleanString(contact.email, 'Correo', { maximum: 120 }),
      instagram: cleanString(contact.instagram, 'Instagram', { maximum: 120 }),
    },
  };
}

export function cleanBuyer(input) {
  if (input === null) return null;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw validationError('Los datos del comprador no son validos.');
  }
  return {
    name: cleanString(input.name, 'Nombre del comprador', { maximum: 100, required: true }),
    phone: cleanString(input.phone, 'Telefono del comprador', { maximum: 40 }),
    notes: cleanString(input.notes, 'Notas', { maximum: 500 }),
    assignedAt: new Date().toISOString(),
  };
}

export function cleanPrize(input, { requireName = true } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw validationError('Los datos del premio no son validos.');
  }
  return {
    name: cleanString(input.name, 'Nombre del premio', { maximum: 100, required: requireName }),
    description: cleanString(input.description, 'Descripcion del premio', { maximum: 500 }),
  };
}
