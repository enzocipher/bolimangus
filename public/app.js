// Firma digital del easter egg: si Mart desaparece, la pagina publica se bloquea.
// Credito: Mart y el GIF original pertenecen a Nullscape Wiki.
// https://nullscape.wiki/Nullscape_Wiki:News
// https://static.wikitide.net/nullscapewiki/9/90/Probably_Improper_Speeded_Mart.gif
const DORON_MART_SIGNATURE = 'Doron::MartKeeper::v1';
const MART_IMAGE_SOURCE = 'https://static.wikitide.net/nullscapewiki/9/90/Probably_Improper_Speeded_Mart.gif';
const martCursor = document.querySelector('#mart-cursor');
const martImage = martCursor?.querySelector('.mart-character');
let martIntegrityLocked = false;

function lockPublicPageForMart() {
  if (martIntegrityLocked) return;
  martIntegrityLocked = true;
  document.documentElement.classList.add('mart-integrity-failed');
  const blocker = document.createElement('div');
  blocker.className = 'mart-integrity-lock';
  blocker.setAttribute('role', 'alert');
  const title = document.createElement('strong');
  title.textContent = 'Mart ha desaparecido.';
  const detail = document.createElement('span');
  detail.textContent = 'La firma digital de Doron no coincide. Restaura a Mart para continuar.';
  blocker.append(title, detail);
  blocker.tabIndex = -1;
  Array.from(document.body.children).forEach((child) => { child.inert = true; });
  document.body.append(blocker);
  blocker.focus();
}

if (!martCursor || martCursor.dataset.doronSignature !== DORON_MART_SIGNATURE) {
  lockPublicPageForMart();
  throw new Error('Doron Mart integrity check failed.');
}

if (!martImage || martImage.getAttribute('src') !== MART_IMAGE_SOURCE) {
  lockPublicPageForMart();
  throw new Error('Doron Mart image check failed.');
}
martImage.addEventListener('error', lockPublicPageForMart, { once: true });
if (martImage.complete && martImage.naturalWidth === 0) {
  lockPublicPageForMart();
  throw new Error('Doron Mart image failed to load.');
}

const martIntegrityObserver = new MutationObserver(() => {
  if (
    !document.body.contains(martCursor)
    || !martCursor.contains(martImage)
    || martCursor.dataset.doronSignature !== DORON_MART_SIGNATURE
    || martImage.getAttribute('src') !== MART_IMAGE_SOURCE
  ) {
    lockPublicPageForMart();
  }
});
martIntegrityObserver.observe(document.body, { childList: true, subtree: true });
martIntegrityObserver.observe(martCursor, { attributes: true, attributeFilter: ['data-doron-signature'] });
martIntegrityObserver.observe(martImage, { attributes: true, attributeFilter: ['src'] });

const elements = {
  title: document.querySelector('#raffle-title'),
  subtitle: document.querySelector('#raffle-subtitle'),
  description: document.querySelector('#raffle-description'),
  date: document.querySelector('#raffle-date'),
  price: document.querySelector('#raffle-price'),
  terms: document.querySelector('#raffle-terms'),
  contactButton: document.querySelector('#hero-contact'),
  prizes: document.querySelector('#prize-grid'),
  contacts: document.querySelector('#contact-links'),
  error: document.querySelector('#page-error'),
  registrationForm: document.querySelector('#registration-form'),
  registrationStatus: document.querySelector('#registration-status'),
  firstNumber: document.querySelector('#first-number'),
  secondNumber: document.querySelector('#second-number'),
  chosenFirst: document.querySelector('#chosen-first'),
  chosenSecond: document.querySelector('#chosen-second'),
  pairPreview: document.querySelector('.choice-pair'),
  tickets: document.querySelector('#ticket-grid'),
  ticketSearch: document.querySelector('#ticket-search'),
  ticketEmpty: document.querySelector('#ticket-empty'),
};

const state = { data: null, ticketQuery: '', ticketFilter: 'all' };
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const interactivePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
let revealObserver;

function textElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function registerRevealTargets(root = document) {
  const targets = root.querySelectorAll([
    '.hero-copy > *',
    '.section-heading',
    '.participation-steps li',
    '.draw-mode',
    '.prize-card',
    '.choice-layout',
    '.ticket-toolbar',
    '.ticket-card',
    '.contact-panel',
    '.terms',
  ].join(','));

  targets.forEach((target, index) => {
    if (target.dataset.revealReady) return;
    target.dataset.revealReady = 'true';
    target.style.setProperty('--reveal-delay', `${Math.min(index % 6, 5) * 65}ms`);
    if (!revealObserver) {
      target.classList.add('is-visible');
      return;
    }
    revealObserver.observe(target);
  });
}

function initializeRevealAnimations() {
  if (reducedMotion.matches || !('IntersectionObserver' in window)) {
    registerRevealTargets();
    return;
  }
  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  registerRevealTargets();
}

function initializeHeroMotion() {
  const heroVisual = document.querySelector('.hero-visual');
  if (!heroVisual || reducedMotion.matches || !interactivePointer.matches) return;
  heroVisual.classList.add('is-interactive');
  heroVisual.addEventListener('pointermove', (event) => {
    const bounds = heroVisual.getBoundingClientRect();
    const horizontal = ((event.clientX - bounds.left) / bounds.width) - 0.5;
    const vertical = ((event.clientY - bounds.top) / bounds.height) - 0.5;
    heroVisual.style.setProperty('--hero-rotate-x', `${vertical * -7}deg`);
    heroVisual.style.setProperty('--hero-rotate-y', `${horizontal * 9}deg`);
    heroVisual.style.setProperty('--hero-shift-x', `${horizontal * 12}px`);
    heroVisual.style.setProperty('--hero-shift-y', `${vertical * 10}px`);
  }, { passive: true });
  heroVisual.addEventListener('pointerleave', () => {
    heroVisual.style.removeProperty('--hero-rotate-x');
    heroVisual.style.removeProperty('--hero-rotate-y');
    heroVisual.style.removeProperty('--hero-shift-x');
    heroVisual.style.removeProperty('--hero-shift-y');
  });
}

function initializeTicketTilt() {
  if (reducedMotion.matches || !interactivePointer.matches) return;
  elements.tickets.addEventListener('pointermove', (event) => {
    const ticket = event.target.closest('.ticket-card');
    if (!ticket) return;
    const bounds = ticket.getBoundingClientRect();
    const horizontal = ((event.clientX - bounds.left) / bounds.width) - 0.5;
    const vertical = ((event.clientY - bounds.top) / bounds.height) - 0.5;
    ticket.style.setProperty('--ticket-rotate-x', `${vertical * -7}deg`);
    ticket.style.setProperty('--ticket-rotate-y', `${horizontal * 9}deg`);
    ticket.style.setProperty('--ticket-glow-x', `${(horizontal + 0.5) * 100}%`);
    ticket.style.setProperty('--ticket-glow-y', `${(vertical + 0.5) * 100}%`);
  }, { passive: true });
  elements.tickets.addEventListener('pointerout', (event) => {
    const ticket = event.target.closest('.ticket-card');
    if (!ticket || ticket.contains(event.relatedTarget)) return;
    ticket.style.removeProperty('--ticket-rotate-x');
    ticket.style.removeProperty('--ticket-rotate-y');
    ticket.style.removeProperty('--ticket-glow-x');
    ticket.style.removeProperty('--ticket-glow-y');
  });
}

function initializeMartFollower() {
  const staticPosition = () => {
    martCursor.style.transform = 'translate3d(calc(100vw - 3.5rem), calc(100vh - 4.5rem), 0)';
    martCursor.classList.add('is-visible', 'is-static');
  };
  if (reducedMotion.matches || !interactivePointer.matches) {
    staticPosition();
    return;
  }

  let currentX = window.innerWidth * 0.82;
  let currentY = window.innerHeight * 0.72;
  let targetX = window.innerWidth * 0.5;
  let targetY = window.innerHeight * 0.45;

  document.addEventListener('pointermove', (event) => {
    targetX = event.clientX;
    targetY = event.clientY;
  }, { passive: true });

  function followPointer() {
    currentX += (targetX - currentX) * 0.018;
    currentY += (targetY - currentY) * 0.018;
    martCursor.style.transform = `translate3d(calc(${currentX}px - 50%), calc(${currentY}px - 50%), 0)`;
    requestAnimationFrame(followPointer);
  }

  martCursor.classList.add('is-visible');
  requestAnimationFrame(followPointer);
}

function populateNumberSelect(select) {
  for (let number = 1; number <= 53; number += 1) {
    const option = document.createElement('option');
    option.value = String(number);
    option.textContent = String(number).padStart(2, '0');
    select.append(option);
  }
}

function updatePairPreview() {
  elements.chosenFirst.textContent = elements.firstNumber.value || '—';
  elements.chosenSecond.textContent = elements.secondNumber.value || '—';
  elements.pairPreview.classList.remove('is-updating');
  requestAnimationFrame(() => elements.pairPreview.classList.add('is-updating'));
  const duplicate = elements.firstNumber.value && elements.firstNumber.value === elements.secondNumber.value;
  elements.secondNumber.setCustomValidity(duplicate ? 'Los dos números deben ser distintos.' : '');
}

function renderPrizes() {
  elements.prizes.replaceChildren();
  if (state.data.prizes.length === 0) {
    elements.prizes.append(textElement('p', 'empty-inline', 'Los premios se publicarán próximamente.'));
    return;
  }

  state.data.prizes.forEach((prize, index) => {
    const article = document.createElement('article');
    article.className = 'prize-card';
    const media = document.createElement('div');
    media.className = 'prize-media';
    const imageUrls = Array.isArray(prize.imageUrls)
      ? prize.imageUrls
      : prize.imageUrl
        ? [prize.imageUrl]
        : [];
    if (imageUrls.length > 0) {
      media.classList.add(`has-${imageUrls.length}-images`);
      imageUrls.forEach((imageUrl, imageIndex) => {
        const image = document.createElement('img');
        image.src = imageUrl;
        image.alt = `${prize.name}, imagen ${imageIndex + 1} de ${imageUrls.length}`;
        image.loading = index === 0 && imageIndex === 0 ? 'eager' : 'lazy';
        image.width = 720;
        image.height = 480;
        media.append(image);
      });
    } else {
      media.classList.add('prize-placeholder');
      media.append(
        textElement('span', 'prize-number', String(index + 1).padStart(2, '0')),
        textElement('small', '', 'Imagen próximamente'),
      );
    }

    const copy = document.createElement('div');
    copy.className = 'prize-copy';
    copy.append(
      textElement('p', 'eyebrow', `Premio ${String(index + 1).padStart(2, '0')}`),
      textElement('h3', '', prize.name),
      textElement('p', '', prize.description),
    );
    article.append(media, copy);
    elements.prizes.append(article);
  });
  registerRevealTargets(elements.prizes);
}

function contactLink(label, href, detail) {
  const link = document.createElement('a');
  link.href = href;
  link.className = 'contact-link';
  link.append(textElement('strong', '', label), textElement('span', '', detail));
  return link;
}

function renderContacts() {
  const contact = state.data.raffle.contact;
  const links = [];
  const whatsappDigits = contact.whatsapp.replace(/\D/g, '');
  if (whatsappDigits) {
    const link = contactLink('WhatsApp', `https://wa.me/${whatsappDigits}`, contact.whatsapp);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    links.push(link);
    elements.contactButton.href = `https://wa.me/${whatsappDigits}`;
    elements.contactButton.target = '_blank';
    elements.contactButton.rel = 'noopener noreferrer';
  }
  if (contact.phone) links.push(contactLink('Teléfono', `tel:${contact.phone.replace(/[^\d+]/g, '')}`, contact.phone));
  if (contact.email) links.push(contactLink('Correo', `mailto:${contact.email}`, contact.email));
  if (contact.instagram) {
    const handle = contact.instagram.replace(/^@/, '').replace(/[^a-zA-Z0-9._]/g, '');
    if (handle) {
      const link = contactLink('Instagram', `https://instagram.com/${handle}`, `@${handle}`);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      links.push(link);
    }
  }
  elements.contacts.replaceChildren(...(links.length
    ? links
    : [textElement('span', 'contact-placeholder', 'Los datos de contacto se publicarán próximamente.')]));
}

function renderRaffle() {
  const raffle = state.data.raffle;
  document.title = raffle.title;
  elements.title.textContent = raffle.title;
  elements.subtitle.textContent = raffle.subtitle || 'Elige dos números distintos del 1 al 53.';
  elements.description.textContent = raffle.description;
  elements.date.textContent = raffle.drawDate || 'Por confirmar';
  elements.price.textContent = raffle.ticketPrice
    ? `${raffle.currency ? `${raffle.currency} ` : ''}${raffle.ticketPrice}`
    : 'Por confirmar';
  elements.terms.textContent = raffle.terms || 'La información definitiva se publicará próximamente.';
}

function renderTickets() {
  const normalizedQuery = state.ticketQuery.trim().toLocaleLowerCase('es');
  const visibleTickets = state.data.tickets.filter((ticket) => {
    if (state.ticketFilter !== 'all' && ticket.buyer.paymentStatus !== state.ticketFilter) return false;
    if (!normalizedQuery) return true;
    const directPair = `${ticket.first}-${ticket.second}`;
    const inversePair = `${ticket.second}-${ticket.first}`;
    return directPair.includes(normalizedQuery)
      || inversePair.includes(normalizedQuery)
      || ticket.buyer.name.toLocaleLowerCase('es').includes(normalizedQuery);
  });

  const cards = visibleTickets.map((ticket) => {
    const pending = ticket.buyer.paymentStatus === 'pending';
    const article = document.createElement('article');
    article.className = `ticket-card is-sold ${pending ? 'is-pending' : 'is-paid'}`;
    article.setAttribute('aria-label', `Ticket ${ticket.first} y ${ticket.second}, ${ticket.buyer.name}, ${pending ? 'pendiente de pago' : 'pago confirmado'}`);

    const header = document.createElement('div');
    header.className = 'ticket-card-header';
    header.append(
      textElement('span', 'ticket-id', 'RIFA'),
      textElement('span', 'ticket-status', pending ? 'Pendiente' : 'Confirmado'),
    );

    const ornament = document.createElement('span');
    ornament.className = 'ticket-ornament';
    ornament.setAttribute('aria-hidden', 'true');

    const pair = document.createElement('div');
    pair.className = 'ticket-pair';
    pair.append(
      textElement('strong', '', String(ticket.first).padStart(2, '0')),
      textElement('span', '', '—'),
      textElement('strong', '', String(ticket.second).padStart(2, '0')),
    );

    article.append(header, ornament, pair, textElement('p', 'ticket-owner', ticket.buyer.name));
    return article;
  });

  elements.tickets.replaceChildren(...cards);
  elements.ticketEmpty.hidden = cards.length > 0;
  registerRevealTargets(elements.tickets);
}

async function loadData() {
  try {
    const response = await fetch('/api/public', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('No se pudo cargar la rifa.');
    state.data = await response.json();
    renderRaffle();
    renderPrizes();
    renderContacts();
    renderTickets();
  } catch (error) {
    console.error(error);
    elements.error.hidden = false;
  }
}

elements.registrationForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  updatePairPreview();
  if (!elements.registrationForm.reportValidity()) return;

  const submitButton = elements.registrationForm.querySelector('button[type="submit"]');
  const first = Number(elements.firstNumber.value);
  const second = Number(elements.secondNumber.value);
  submitButton.disabled = true;
  elements.registrationForm.setAttribute('aria-busy', 'true');
  elements.registrationStatus.textContent = 'Guardando tu reserva…';
  elements.registrationStatus.classList.remove('is-error', 'is-success');

  try {
    const response = await fetch('/api/public/tickets/register', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Rifa-Public': '1',
      },
      body: JSON.stringify({
        first,
        second,
        name: elements.registrationForm.elements.namedItem('name').value,
        phone: elements.registrationForm.elements.namedItem('phone').value,
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message || 'No se pudo registrar la reserva.');

    elements.registrationForm.reset();
    updatePairPreview();
    elements.registrationStatus.textContent = `¡Listo! El ticket ${first}—${second} quedó pendiente de verificación de pago.`;
    elements.registrationStatus.classList.add('is-success');
    await loadData();
  } catch (error) {
    elements.registrationStatus.textContent = error.message;
    elements.registrationStatus.classList.add('is-error');
  } finally {
    submitButton.disabled = false;
    elements.registrationForm.setAttribute('aria-busy', 'false');
  }
});

populateNumberSelect(elements.firstNumber);
populateNumberSelect(elements.secondNumber);
elements.firstNumber.addEventListener('change', updatePairPreview);
elements.secondNumber.addEventListener('change', updatePairPreview);
elements.ticketSearch.addEventListener('input', (event) => {
  state.ticketQuery = event.target.value;
  renderTickets();
});
document.querySelectorAll('input[name="ticket-filter"]').forEach((input) => {
  input.addEventListener('change', (event) => {
    state.ticketFilter = event.target.value;
    renderTickets();
  });
});
initializeRevealAnimations();
initializeHeroMotion();
initializeTicketTilt();
initializeMartFollower();
void loadData();
