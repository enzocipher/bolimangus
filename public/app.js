const elements = {
  title: document.querySelector('#raffle-title'),
  subtitle: document.querySelector('#raffle-subtitle'),
  description: document.querySelector('#raffle-description'),
  date: document.querySelector('#raffle-date'),
  price: document.querySelector('#raffle-price'),
  terms: document.querySelector('#raffle-terms'),
  contactButton: document.querySelector('#hero-contact'),
  total: document.querySelector('#stat-total'),
  available: document.querySelector('#stat-available'),
  sold: document.querySelector('#stat-sold'),
  prizes: document.querySelector('#prize-grid'),
  tickets: document.querySelector('#ticket-grid'),
  search: document.querySelector('#ticket-search'),
  summary: document.querySelector('#results-summary'),
  empty: document.querySelector('#ticket-empty'),
  contacts: document.querySelector('#contact-links'),
  error: document.querySelector('#page-error'),
  pageTicketLabel: document.querySelector('#page-ticket-label'),
};

const pageMatch = window.location.pathname.match(/^\/(1|2)\/?$/);
const ticketPage = pageMatch ? Number(pageMatch[1]) : 1;
const ticketsPerPage = 53;

const state = {
  data: null,
  query: '',
  filter: 'all',
};

function visibleTickets() {
  return state.data.tickets;
}

function textElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function formatPair(ticket) {
  return `${ticket.first}-${ticket.second}`;
}

function renderStats() {
  const tickets = visibleTickets();
  const sold = tickets.filter((ticket) => ticket.buyer).length;
  elements.total.textContent = String(tickets.length);
  elements.sold.textContent = String(sold);
  elements.available.textContent = String(tickets.length - sold);
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
    if (prize.imageUrl) {
      const image = document.createElement('img');
      image.src = prize.imageUrl;
      image.alt = prize.name;
      image.loading = index === 0 ? 'eager' : 'lazy';
      image.width = 720;
      image.height = 480;
      media.append(image);
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
}

function matchesTicket(ticket) {
  if (state.filter === 'available' && ticket.buyer) return false;
  if (state.filter === 'sold' && !ticket.buyer) return false;
  if (!state.query) return true;

  const haystack = [
    ticket.id || '',
    formatPair(ticket),
    `${ticket.first} - ${ticket.second}`,
    ticket.buyer?.name || '',
  ].join(' ').toLocaleLowerCase('es');
  return haystack.includes(state.query);
}

function renderTickets() {
  const matches = visibleTickets().filter(matchesTicket);
  elements.tickets.replaceChildren();

  for (const ticket of matches) {
    const article = document.createElement('article');
    article.className = `ticket-card ${ticket.buyer ? 'is-sold' : 'is-available'}`;
    article.setAttribute('aria-label', `Números ${ticket.first} y ${ticket.second}, ${ticket.buyer ? `comprado por ${ticket.buyer.name}` : 'disponible'}`);

    const header = document.createElement('div');
    header.className = 'ticket-card-header';
    header.append(
      textElement('span', 'ticket-id', 'RIFA'),
      textElement('span', 'ticket-status', ticket.buyer ? 'Comprado' : 'Disponible'),
    );

    const pair = document.createElement('p');
    pair.className = 'ticket-pair';
    pair.append(
      textElement('strong', '', String(ticket.first)),
      textElement('span', '', '—'),
      textElement('strong', '', String(ticket.second)),
    );

    const ornament = textElement('span', 'ticket-ornament', '');
    ornament.setAttribute('aria-hidden', 'true');

    const owner = textElement(
      'p',
      'ticket-owner',
      ticket.buyer ? ticket.buyer.name : 'Aún sin participante',
    );
    article.append(header, ornament, pair, owner);
    elements.tickets.append(article);
  }

  elements.summary.textContent = `${matches.length} ${matches.length === 1 ? 'ticket encontrado' : 'tickets encontrados'}`;
  elements.empty.hidden = matches.length > 0;
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
  elements.pageTicketLabel.textContent = `Sorteo activo · ${ticketsPerPage} tickets`;
  elements.title.textContent = raffle.title;
  elements.subtitle.textContent = raffle.subtitle || 'Dos números, una oportunidad para ganar.';
  elements.description.textContent = raffle.description;
  elements.date.textContent = raffle.drawDate || 'Por confirmar';
  elements.price.textContent = raffle.ticketPrice
    ? `${raffle.currency ? `${raffle.currency} ` : ''}${raffle.ticketPrice}`
    : 'Por confirmar';
  elements.terms.textContent = raffle.terms || 'La información definitiva se publicará próximamente.';
}

async function loadData() {
  try {
    const response = await fetch(`/api/public/${ticketPage}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('No se pudo cargar la rifa.');
    state.data = await response.json();
    renderRaffle();
    renderStats();
    renderPrizes();
    renderContacts();
    renderTickets();
  } catch (error) {
    console.error(error);
    elements.error.hidden = false;
    elements.summary.textContent = 'Información no disponible';
  }
}

elements.search.addEventListener('input', (event) => {
  state.query = event.target.value.trim().toLocaleLowerCase('es');
  if (state.data) renderTickets();
});

document.querySelectorAll('input[name="ticket-filter"]').forEach((input) => {
  input.addEventListener('change', (event) => {
    state.filter = event.target.value;
    if (state.data) renderTickets();
  });
});

void loadData();
