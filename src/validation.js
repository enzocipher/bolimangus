import { validationError } from './errors.js';

export function cleanString(value, field, { maximum = 200, minimum = 0, required = false } = {}) {
  if (value === null || value === undefined) {
    if (required) throw validationError(`${field} es obligatorio.`);
    return '';
  }
  if (typeof value !== 'string') throw validationError(`${field} debe ser texto.`);
  const cleaned = value.trim();
  if (required && cleaned.length === 0) throw validationError(`${field} es obligatorio.`);
  if (cleaned.length > 0 && cleaned.length < minimum) throw validationError(`${field} debe tener al menos ${minimum} caracteres.`);
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

export function cleanBuyer(input, {
  assignedAt,
  defaultPaymentStatus = 'paid',
  phoneRequired = false,
  source = 'admin',
} = {}) {
  if (input === null) return null;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw validationError('Los datos del comprador no son validos.');
  }
  const paymentStatus = input.paymentStatus ?? defaultPaymentStatus;
  if (!['pending', 'paid'].includes(paymentStatus)) {
    throw validationError('El estado de pago debe ser pendiente o pagado.');
  }
  if (!['admin', 'public'].includes(source)) {
    throw validationError('El origen del comprador no es valido.');
  }

  const buyer = {
    name: cleanString(input.name, 'Nombre del comprador', { maximum: 100, minimum: 2, required: true }),
    phone: cleanString(input.phone, 'Telefono del comprador', { maximum: 40, required: phoneRequired }),
    notes: cleanString(input.notes, 'Notas', { maximum: 500 }),
    paymentStatus,
    source,
    assignedAt: assignedAt || new Date().toISOString(),
  };

  if (phoneRequired && buyer.phone.replace(/\D/g, '').length < 6) {
    throw validationError('Ingresa un telefono valido con al menos 6 digitos.');
  }
  return buyer;
}

export function cleanPublicBuyer(input) {
  const publicInput = input && typeof input === 'object' && !Array.isArray(input)
    ? { name: input.name, phone: input.phone, notes: '' }
    : input;
  return cleanBuyer(publicInput, {
    defaultPaymentStatus: 'pending',
    phoneRequired: true,
    source: 'public',
  });
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
