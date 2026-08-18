const views = {
  login: document.querySelector('#login-view'),
  dashboard: document.querySelector('#dashboard-view'),
};

const elements = {
  loginForm: document.querySelector('#login-form'),
  loginMessage: document.querySelector('#login-message'),
  logoutButton: document.querySelector('#logout-button'),
  refreshButton: document.querySelector('#refresh-button'),
  settingsForm: document.querySelector('#settings-form'),
  newPrizeForm: document.querySelector('#new-prize-form'),
  prizeList: document.querySelector('#admin-prize-list'),
  prizeDialog: document.querySelector('#prize-dialog'),
  prizeForm: document.querySelector('#prize-form'),
  ticketList: document.querySelector('#admin-ticket-list'),
  ticketSearch: document.querySelector('#admin-ticket-search'),
  ticketFilter: document.querySelector('#admin-ticket-filter'),
  ticketSummary: document.querySelector('#admin-ticket-summary'),
  ticketDialog: document.querySelector('#ticket-dialog'),
  ticketDialogTitle: document.querySelector('#ticket-dialog-title'),
  ticketDialogPair: document.querySelector('#ticket-dialog-pair'),
  ticketDialogOrigin: document.querySelector('#ticket-dialog-origin'),
  ticketForm: document.querySelector('#ticket-form'),
  releaseTicketButton: document.querySelector('#release-ticket-button'),
  total: document.querySelector('#admin-total'),
  pending: document.querySelector('#admin-pending'),
  paid: document.querySelector('#admin-paid'),
  available: document.querySelector('#admin-available'),
  prizeCount: document.querySelector('#admin-prizes'),
  toast: document.querySelector('#admin-toast'),
};

const state = {
  data: null,
  ticketQuery: '',
  ticketFilter: 'all',
  toastTimer: null,
};

function field(form, name) {
  return form.elements.namedItem(name);
}

function textElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function showToast(message, isError = false) {
  clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle('is-error', isError);
  elements.toast.hidden = false;
  state.toastTimer = setTimeout(() => {
    elements.toast.hidden = true;
  }, 4_500);
}

function showLogin(message = '') {
  views.dashboard.hidden = true;
  views.login.hidden = false;
  elements.loginMessage.textContent = message;
  field(elements.loginForm, 'password').focus();
}

function showDashboard() {
  views.login.hidden = true;
  views.dashboard.hidden = false;
  elements.loginMessage.textContent = '';
}

async function api(url, options = {}) {
  const method = options.method || 'GET';
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');
  if (!['GET', 'HEAD'].includes(method)) headers.set('X-Rifa-Admin', '1');

  let body = options.body;
  if (body && !(body instanceof FormData) && typeof body === 'object') {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(body);
  }

  const response = await fetch(url, {
    ...options,
    method,
    headers,
    body,
    credentials: 'same-origin',
  });

  if (response.status === 401 && url !== '/api/admin/login') {
    showLogin('La sesión terminó. Ingresa nuevamente.');
  }

  if (!response.ok) {
    let message = 'No se pudo completar la operación.';
    try {
      const payload = await response.json();
      message = payload.error?.message || message;
    } catch {
      // La respuesta sin JSON conserva el mensaje seguro y genérico.
    }
    throw new Error(message);
  }

  return response.status === 204 ? null : response.json();
}

function setBusy(form, busy) {
  const submit = form.querySelector('button[type="submit"]');
  if (submit) submit.disabled = busy;
  form.setAttribute('aria-busy', String(busy));
}

function renderStats() {
  const occupied = state.data.tickets.filter((ticket) => ticket.buyer);
  const pending = occupied.filter((ticket) => ticket.buyer.paymentStatus === 'pending').length;
  const paid = occupied.length - pending;
  elements.total.textContent = String(state.data.tickets.length);
  elements.pending.textContent = String(pending);
  elements.paid.textContent = String(paid);
  elements.available.textContent = String(state.data.tickets.length - occupied.length);
  elements.prizeCount.textContent = String(state.data.prizes.length);
}

function fillSettingsForm() {
  const raffle = state.data.raffle;
  for (const name of ['title', 'subtitle', 'description', 'drawDate', 'ticketPrice', 'currency', 'terms']) {
    field(elements.settingsForm, name).value = raffle[name] || '';
  }
  for (const name of ['whatsapp', 'phone', 'email', 'instagram']) {
    field(elements.settingsForm, name).value = raffle.contact[name] || '';
  }
}

function prizeButton(label, className, handler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', handler);
  return button;
}

function openPrizeDialog(prize) {
  field(elements.prizeForm, 'prizeId').value = prize.id;
  field(elements.prizeForm, 'name').value = prize.name;
  field(elements.prizeForm, 'description').value = prize.description;
  field(elements.prizeForm, 'image').value = '';
  elements.prizeDialog.showModal();
  field(elements.prizeForm, 'name').focus();
}

async function deletePrize(prize) {
  const accepted = window.confirm(`¿Eliminar “${prize.name}”? La imagen asociada también se eliminará del servidor.`);
  if (!accepted) return;
  try {
    await api(`/api/admin/prizes/${encodeURIComponent(prize.id)}`, { method: 'DELETE' });
    showToast('Premio eliminado.');
    await loadData();
  } catch (error) {
    showToast(error.message, true);
  }
}

function renderPrizes() {
  elements.prizeList.replaceChildren();
  if (state.data.prizes.length === 0) {
    elements.prizeList.append(textElement('p', 'empty-inline', 'Todavía no hay premios.'));
    return;
  }

  for (const prize of state.data.prizes) {
    const article = document.createElement('article');
    article.className = 'admin-prize-card';

    const media = document.createElement('div');
    media.className = 'admin-prize-image';
    if (prize.imageUrl) {
      const image = document.createElement('img');
      image.src = prize.imageUrl;
      image.alt = '';
      image.loading = 'lazy';
      image.width = 600;
      image.height = 290;
      media.append(image);
    } else {
      media.textContent = 'Sin imagen';
    }

    const copy = document.createElement('div');
    copy.className = 'admin-prize-copy';
    const actions = document.createElement('div');
    actions.className = 'form-actions';
    actions.append(
      prizeButton('Editar', 'button button-secondary button-small', () => openPrizeDialog(prize)),
      prizeButton('Eliminar', 'button button-danger button-small', () => void deletePrize(prize)),
    );
    copy.append(
      textElement('h3', '', prize.name),
      textElement('p', '', prize.description || 'Sin descripción.'),
      actions,
    );
    article.append(media, copy);
    elements.prizeList.append(article);
  }
}

function ticketMatches(ticket) {
  if (state.ticketFilter === 'available' && ticket.buyer) return false;
  if (state.ticketFilter === 'pending' && ticket.buyer?.paymentStatus !== 'pending') return false;
  if (state.ticketFilter === 'paid' && (!ticket.buyer || ticket.buyer.paymentStatus === 'pending')) return false;
  if (!state.ticketQuery) return true;
  return [
    ticket.id,
    `${ticket.first}-${ticket.second}`,
    `${ticket.first} - ${ticket.second}`,
    ticket.buyer?.name || '',
    ticket.buyer?.phone || '',
    ticket.buyer?.source || '',
  ].join(' ').toLocaleLowerCase('es').includes(state.ticketQuery);
}

function openTicketDialog(ticket) {
  elements.ticketDialogTitle.textContent = ticket.buyer ? `Editar ${ticket.id}` : `Asignar ${ticket.id}`;
  elements.ticketDialogPair.textContent = `Par único: ${ticket.first} — ${ticket.second}`;
  field(elements.ticketForm, 'ticketId').value = ticket.id;
  field(elements.ticketForm, 'name').value = ticket.buyer?.name || '';
  field(elements.ticketForm, 'phone').value = ticket.buyer?.phone || '';
  field(elements.ticketForm, 'notes').value = ticket.buyer?.notes || '';
  field(elements.ticketForm, 'paymentStatus').value = ticket.buyer?.paymentStatus === 'pending' ? 'pending' : 'paid';
  elements.ticketDialogOrigin.textContent = ticket.buyer
    ? `Origen: ${ticket.buyer.source === 'public' ? 'inscripción desde la web' : 'asignación administrativa'}`
    : 'Ticket libre: la asignación se realizará desde el panel.';
  elements.releaseTicketButton.disabled = !ticket.buyer;
  elements.ticketDialog.showModal();
  field(elements.ticketForm, 'name').focus();
}

function renderTickets() {
  const tickets = state.data.tickets.filter(ticketMatches);
  elements.ticketList.replaceChildren();
  for (const ticket of tickets) {
    const isPending = ticket.buyer?.paymentStatus === 'pending';
    const row = document.createElement('article');
    row.className = `admin-ticket-row ${ticket.buyer ? (isPending ? 'is-pending' : 'is-paid') : 'is-available'}`;
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'button button-secondary button-small';
    edit.textContent = ticket.buyer ? 'Editar' : 'Asignar';
    edit.addEventListener('click', () => openTicketDialog(ticket));

    row.append(
      textElement('span', 'admin-ticket-id', ticket.id),
      textElement('strong', 'admin-ticket-pair', `${ticket.first} — ${ticket.second}`),
      textElement('p', 'admin-ticket-buyer', ticket.buyer?.name || 'Disponible'),
      textElement('p', 'admin-ticket-phone', ticket.buyer?.phone || 'Sin teléfono'),
      textElement(
        'span',
        `admin-ticket-payment ${ticket.buyer ? (isPending ? 'is-pending' : 'is-paid') : 'is-available'}`,
        ticket.buyer
          ? `${isPending ? 'Pendiente' : 'Pagado'} · ${ticket.buyer.source === 'public' ? 'Web' : 'Admin'}`
          : 'Disponible',
      ),
      edit,
    );
    elements.ticketList.append(row);
  }
  elements.ticketSummary.textContent = `${tickets.length} ${tickets.length === 1 ? 'ticket visible' : 'tickets visibles'}`;
  if (tickets.length === 0) {
    elements.ticketList.append(textElement('p', 'empty-inline', 'No hay tickets que coincidan con la búsqueda.'));
  }
}

function renderAll() {
  renderStats();
  fillSettingsForm();
  renderPrizes();
  renderTickets();
}

async function loadData({ announce = false } = {}) {
  const payload = await api('/api/admin/data');
  state.data = payload;
  renderAll();
  if (announce) showToast('Datos actualizados.');
}

elements.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setBusy(elements.loginForm, true);
  elements.loginMessage.textContent = '';
  try {
    await api('/api/admin/login', {
      method: 'POST',
      body: { password: field(elements.loginForm, 'password').value },
    });
    field(elements.loginForm, 'password').value = '';
    showDashboard();
    await loadData();
  } catch (error) {
    elements.loginMessage.textContent = error.message;
  } finally {
    setBusy(elements.loginForm, false);
  }
});

elements.logoutButton.addEventListener('click', async () => {
  try {
    await api('/api/admin/logout', { method: 'POST' });
  } catch (error) {
    console.error(error);
  }
  state.data = null;
  showLogin();
});

elements.refreshButton.addEventListener('click', async () => {
  try {
    await loadData({ announce: true });
  } catch (error) {
    showToast(error.message, true);
  }
});

elements.settingsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setBusy(elements.settingsForm, true);
  const body = {
    title: field(elements.settingsForm, 'title').value,
    subtitle: field(elements.settingsForm, 'subtitle').value,
    description: field(elements.settingsForm, 'description').value,
    drawDate: field(elements.settingsForm, 'drawDate').value,
    ticketPrice: field(elements.settingsForm, 'ticketPrice').value,
    currency: field(elements.settingsForm, 'currency').value,
    terms: field(elements.settingsForm, 'terms').value,
    contact: {
      whatsapp: field(elements.settingsForm, 'whatsapp').value,
      phone: field(elements.settingsForm, 'phone').value,
      email: field(elements.settingsForm, 'email').value,
      instagram: field(elements.settingsForm, 'instagram').value,
    },
  };
  try {
    await api('/api/admin/raffle', { method: 'PATCH', body });
    showToast('Información guardada.');
    await loadData();
  } catch (error) {
    showToast(error.message, true);
  } finally {
    setBusy(elements.settingsForm, false);
  }
});

elements.newPrizeForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setBusy(elements.newPrizeForm, true);
  try {
    await api('/api/admin/prizes', {
      method: 'POST',
      body: new FormData(elements.newPrizeForm),
    });
    elements.newPrizeForm.reset();
    showToast('Premio agregado.');
    await loadData();
  } catch (error) {
    showToast(error.message, true);
  } finally {
    setBusy(elements.newPrizeForm, false);
  }
});

elements.prizeForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setBusy(elements.prizeForm, true);
  const prizeId = field(elements.prizeForm, 'prizeId').value;
  try {
    await api(`/api/admin/prizes/${encodeURIComponent(prizeId)}`, {
      method: 'PATCH',
      body: {
        name: field(elements.prizeForm, 'name').value,
        description: field(elements.prizeForm, 'description').value,
      },
    });
    const image = field(elements.prizeForm, 'image').files[0];
    if (image) {
      const formData = new FormData();
      formData.append('image', image);
      await api(`/api/admin/prizes/${encodeURIComponent(prizeId)}/image`, {
        method: 'POST',
        body: formData,
      });
    }
    elements.prizeDialog.close();
    showToast('Premio actualizado.');
    await loadData();
  } catch (error) {
    showToast(error.message, true);
  } finally {
    setBusy(elements.prizeForm, false);
  }
});

elements.ticketForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setBusy(elements.ticketForm, true);
  const ticketId = field(elements.ticketForm, 'ticketId').value;
  try {
    await api(`/api/admin/tickets/${encodeURIComponent(ticketId)}`, {
      method: 'PATCH',
      body: {
        buyer: {
          name: field(elements.ticketForm, 'name').value,
          phone: field(elements.ticketForm, 'phone').value,
          notes: field(elements.ticketForm, 'notes').value,
          paymentStatus: field(elements.ticketForm, 'paymentStatus').value,
        },
      },
    });
    elements.ticketDialog.close();
    showToast('Participante y estado de pago guardados.');
    await loadData();
  } catch (error) {
    showToast(error.message, true);
  } finally {
    setBusy(elements.ticketForm, false);
  }
});

elements.releaseTicketButton.addEventListener('click', async () => {
  const ticketId = field(elements.ticketForm, 'ticketId').value;
  if (!window.confirm(`¿Retirar a la persona de ${ticketId}, borrar sus datos y dejar el ticket disponible?`)) return;
  elements.releaseTicketButton.disabled = true;
  try {
    await api(`/api/admin/tickets/${encodeURIComponent(ticketId)}`, {
      method: 'PATCH',
      body: { buyer: null },
    });
    elements.ticketDialog.close();
    showToast('El ticket está disponible nuevamente.');
    await loadData();
  } catch (error) {
    showToast(error.message, true);
  } finally {
    elements.releaseTicketButton.disabled = false;
  }
});

elements.ticketSearch.addEventListener('input', (event) => {
  state.ticketQuery = event.target.value.trim().toLocaleLowerCase('es');
  if (state.data) renderTickets();
});

elements.ticketFilter.addEventListener('change', (event) => {
  state.ticketFilter = event.target.value;
  if (state.data) renderTickets();
});

async function initialize() {
  try {
    await api('/api/admin/session');
    showDashboard();
    await loadData();
  } catch {
    showLogin();
  }
}

void initialize();
