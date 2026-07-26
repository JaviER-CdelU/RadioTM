const ROUTES = {
  inicio: { file: 'index.html', title: 'Inicio | Radio Tiempo Muerto' },
  noticias: { file: 'noticias.html', title: 'Noticias | Radio Tiempo Muerto' },
  corresponsales: { file: 'corresponsales.html', title: 'Corresponsales | Radio Tiempo Muerto' },
  comunidad: { file: 'comunidad.html', title: 'Comunidad | Radio Tiempo Muerto' },
  podcasts: { file: 'podcasts.html', title: 'Podcasts | Radio Tiempo Muerto' },
  'clima-rio': { file: 'clima-rio.html', title: 'Clima y río | Radio Tiempo Muerto' },
  aportes: { file: 'aportes.html', title: 'Aportes | Radio Tiempo Muerto' },
  contacto: { file: 'contacto.html', title: 'Contacto | Radio Tiempo Muerto' },
  ayuda: { file: 'ayuda.html', title: 'Ayuda | Radio Tiempo Muerto' }
};

const FILE_TO_ROUTE = Object.fromEntries(Object.entries(ROUTES).map(([route, item]) => [item.file, route]));
const appShell = Boolean(document.querySelector('.persistent-radio') && document.querySelector('#radio-stream'));
const routeCache = new Map();
let currentRoute = 'inicio';
let currentMain = document.querySelector('main');
if (appShell && currentMain) routeCache.set('inicio', currentMain);

const navButton = document.querySelector('.menu-btn');
const nav = document.querySelector('.nav');
if (navButton && nav) {
  navButton.addEventListener('click', () => {
    const opened = nav.classList.toggle('open');
    navButton.setAttribute('aria-expanded', String(opened));
    navButton.textContent = opened ? '✕ Cerrar' : '☰ Menú';
  });
}

const toast = document.querySelector('.toast');
function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2800);
}
window.rtmShowToast = showToast;

// -----------------------------------------------------------------------------
// Reproductor permanente: está fuera del contenido que cambia entre secciones.
// -----------------------------------------------------------------------------
const radioAudio = document.querySelector('#radio-stream');
let radioState = 'stopped';
let radioMessage = 'La radio seguirá sonando mientras recorrés las secciones.';

function allRadioButtons() {
  return document.querySelectorAll('[data-radio-toggle]');
}
function allRadioLabels() {
  return document.querySelectorAll('[data-radio-label]');
}
function allRadioStatuses() {
  return document.querySelectorAll('[data-radio-status]');
}

function setRadioState(state, message) {
  radioState = state;
  radioMessage = message;
  allRadioButtons().forEach((button) => {
    button.classList.toggle('is-loading', state === 'loading');
    button.classList.toggle('is-playing', state === 'playing');
    if (state === 'playing') {
      button.textContent = '❚❚';
      button.setAttribute('aria-label', 'Pausar Radio Tiempo Muerto');
    } else if (state === 'loading') {
      button.textContent = '…';
      button.setAttribute('aria-label', 'Conectando con Radio Tiempo Muerto');
    } else {
      button.textContent = '▶';
      button.setAttribute('aria-label', 'Reproducir Radio Tiempo Muerto');
    }
  });
  allRadioLabels().forEach((label) => {
    label.textContent = state === 'playing' ? 'RADIO EN VIVO' : state === 'loading' ? 'CONECTANDO…' : 'TOCAR PARA ESCUCHAR';
  });
  allRadioStatuses().forEach((status) => {
    status.textContent = message;
  });
}

async function toggleRadio() {
  if (!radioAudio) return;
  if (!radioAudio.paused) {
    radioAudio.pause();
    setRadioState('paused', 'Transmisión pausada. Tocá ▶ para volver a escuchar.');
    return;
  }
  setRadioState('loading', 'Conectando con el servidor de la radio…');
  try {
    if (radioAudio.error) radioAudio.load();
    await radioAudio.play();
    setRadioState('playing', 'Estás escuchando Radio Tiempo Muerto en vivo.');
  } catch (error) {
    console.error(error);
    setRadioState('stopped', 'No se pudo iniciar la señal. Puede estar momentáneamente fuera de línea.');
    showToast('No se pudo iniciar la señal. Probá nuevamente en unos segundos.');
  }
}

document.addEventListener('click', (event) => {
  const radioButton = event.target.closest('[data-radio-toggle]');
  if (radioButton) {
    event.preventDefault();
    toggleRadio();
  }
});

if (radioAudio) {
  radioAudio.addEventListener('playing', () => setRadioState('playing', 'Estás escuchando Radio Tiempo Muerto en vivo.'));
  radioAudio.addEventListener('waiting', () => setRadioState('loading', 'Esperando datos de la transmisión…'));
  radioAudio.addEventListener('stalled', () => setRadioState('loading', 'La conexión está lenta. Intentando reconectar…'));
  radioAudio.addEventListener('error', () => setRadioState('stopped', 'La señal no está disponible en este momento.'));
}

// -----------------------------------------------------------------------------
// Navegación interna sin recargar: mantiene viva la señal de radio.
// -----------------------------------------------------------------------------
function normalizeRoute(value) {
  const route = String(value || '').replace(/^#/, '').trim();
  return ROUTES[route] ? route : 'inicio';
}

function updateActiveNav(route) {
  document.querySelectorAll('.nav a').forEach((link) => {
    const href = link.getAttribute('href') || '';
    link.classList.toggle('active', href === `#${route}`);
  });
  if (nav?.classList.contains('open')) {
    nav.classList.remove('open');
    navButton?.setAttribute('aria-expanded', 'false');
    if (navButton) navButton.textContent = '☰ Menú';
  }
}

function showRouteLoading() {
  document.body.classList.add('route-loading');
}
function hideRouteLoading() {
  document.body.classList.remove('route-loading');
}

async function getRouteMain(route) {
  if (routeCache.has(route)) return routeCache.get(route);
  const response = await fetch(ROUTES[route].file, { cache: 'no-store' });
  if (!response.ok) throw new Error(`No se pudo abrir ${ROUTES[route].file}`);
  const html = await response.text();
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const main = parsed.querySelector('main');
  if (!main) throw new Error('La sección no contiene un bloque principal.');
  main.id = 'app-main';
  main.dataset.route = route;
  routeCache.set(route, main);
  return main;
}

async function navigateTo(route, { scroll = true } = {}) {
  route = normalizeRoute(route);
  if (!currentMain) return;
  if (route === currentRoute && currentMain.isConnected) {
    updateActiveNav(route);
    renderRiverData(lastRiverData, currentMain);
    return;
  }
  showRouteLoading();
  try {
    const nextMain = await getRouteMain(route);
    currentMain.replaceWith(nextMain);
    currentMain = nextMain;
    currentRoute = route;
    document.title = ROUTES[route].title;
    updateActiveNav(route);
    initDynamicContent(currentMain);
    renderRiverData(lastRiverData, currentMain);
    if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    console.error(error);
    showToast('No se pudo abrir esa sección. Recargá la página e intentá nuevamente.');
  } finally {
    hideRouteLoading();
  }
}

if (appShell) window.addEventListener('hashchange', () => navigateTo(location.hash));

document.addEventListener('click', (event) => {
  if (!appShell) return;
  const anchor = event.target.closest('a[href]');
  if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
  const href = anchor.getAttribute('href');
  if (!href) return;

  const rawHashRoute = href.startsWith('#') ? href.slice(1) : '';
  if (ROUTES[rawHashRoute]) {
    const route = rawHashRoute;
    event.preventDefault();
    if (location.hash === `#${route}`) navigateTo(route);
    else location.hash = route;
    return;
  }

  const cleanFile = href.split('?')[0].split('#')[0].replace(/^\.\//, '');
  const route = FILE_TO_ROUTE[cleanFile];
  if (route) {
    event.preventDefault();
    location.hash = route;
  }
});

// -----------------------------------------------------------------------------
// Datos del río: archivo JSON propio, actualizado por GitHub Actions desde PNA.
// -----------------------------------------------------------------------------
const RIVER_URL = 'assets/data/rio.json';
const RIVER_STORAGE_KEY = 'rtm-river-last-valid';
let lastRiverData = null;

function numberAR(value, digits = 2) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('es-AR', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '--';
}

function trendLabel(value) {
  const trend = String(value || '').toUpperCase();
  if (trend.includes('CREC')) return 'Creciendo ↑';
  if (trend.includes('BAJ')) return 'Bajando ↓';
  return 'Estable →';
}

function variationLabel(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'Sin variación disponible';
  const cm = Math.round(Math.abs(n) * 100);
  if (n > 0) return `Subió ${cm} cm`;
  if (n < 0) return `Bajó ${cm} cm`;
  return 'Sin cambios';
}

function riverLevelClass(data) {
  const current = Number(data?.current);
  const alert = Number(data?.alert);
  const evacuation = Number(data?.evacuation);
  if (Number.isFinite(evacuation) && current >= evacuation) return 'evacuation';
  if (Number.isFinite(alert) && current >= alert) return 'alert';
  if (Number.isFinite(alert) && current >= alert - 0.5) return 'warning';
  return 'normal';
}

function formatCheckedAt(value) {
  if (!value) return 'Sin horario';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' });
}

function setText(root, selector, value) {
  root.querySelectorAll(selector).forEach((node) => { node.textContent = value; });
}

function renderRiverData(data, root = document) {
  if (!data || !root) return;
  const levelClass = riverLevelClass(data);
  const trend = trendLabel(data.trend);
  const variation = variationLabel(data.variation);

  setText(root, '[data-river-height]', numberAR(data.current));
  setText(root, '[data-river-trend]', trend);
  setText(root, '[data-river-variation]', variation);
  setText(root, '[data-river-previous]', `${numberAR(data.previous)} m`);
  setText(root, '[data-river-updated]', String(data.official_updated || 'Sin horario'));
  setText(root, '[data-river-checked]', formatCheckedAt(data.checked_at));
  setText(root, '[data-river-alert-level]', `${numberAR(data.alert)} m`);
  setText(root, '[data-river-evacuation]', `${numberAR(data.evacuation)} m`);
  setText(root, '[data-river-alert]', `Altura oficial: ${numberAR(data.current)} m · ${trend.toLowerCase()} · ${variation.toLowerCase()}.`);
  setText(root, '[data-river-alert-time]', `Registro PNA: ${data.official_updated || 'sin horario'}`);
  setText(root, '[data-river-notice]', `Seguimiento prioritario: ${numberAR(data.current)} m, ${trend.toLowerCase()}. Fuente oficial: Prefectura Naval Argentina.`);

  root.querySelectorAll('[data-river-trend]').forEach((node) => {
    node.classList.remove('normal', 'warning', 'alert', 'evacuation');
    node.classList.add(levelClass);
  });
  root.querySelectorAll('[data-river-card]').forEach((node) => {
    node.dataset.riverLevel = levelClass;
  });
}

async function loadRiverData() {
  try {
    const response = await fetch(RIVER_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error('Respuesta inválida del archivo del río.');
    const data = await response.json();
    if (!Number.isFinite(Number(data.current))) throw new Error('El dato del río no es válido.');
    lastRiverData = data;
    localStorage.setItem(RIVER_STORAGE_KEY, JSON.stringify(data));
    renderRiverData(data, document);
  } catch (error) {
    console.warn(error);
    try {
      const stored = JSON.parse(localStorage.getItem(RIVER_STORAGE_KEY) || 'null');
      if (stored) {
        lastRiverData = stored;
        renderRiverData(stored, document);
      }
    } catch (_) {}
  }
}

// -----------------------------------------------------------------------------
// Controles de cada sección cargada dinámicamente.
// -----------------------------------------------------------------------------
function initDynamicContent(root = document) {
  setRadioState(radioState, radioMessage);

  root.querySelectorAll('.mini-play:not([data-ready])').forEach((button) => {
    button.dataset.ready = 'true';
    button.addEventListener('click', () => {
      const playing = button.dataset.playing === 'true';
      button.dataset.playing = String(!playing);
      button.textContent = playing ? '▶' : '❚❚';
      showToast('Este podcast se conectará cuando tengamos el archivo de audio.');
    });
  });

  root.querySelectorAll('[data-demo]:not([data-ready])').forEach((element) => {
    element.dataset.ready = 'true';
    element.addEventListener('click', (event) => {
      if (element.tagName === 'A' && element.getAttribute('href') !== '#') return;
      event.preventDefault();
      showToast(element.dataset.demo || 'Función preparada para conectar.');
    });
  });

  root.querySelectorAll('[data-source-row]:not([data-ready])').forEach((row) => {
    row.dataset.ready = 'true';
    const key = row.dataset.sourceRow;
    const toggle = row.querySelector('[data-toggle]');
    const quantity = row.querySelector('[data-quantity]');
    const save = row.querySelector('[data-save]');
    const stored = localStorage.getItem(`rtm-source-${key}`);
    if (stored) {
      try {
        const value = JSON.parse(stored);
        if (toggle) {
          toggle.classList.toggle('on', value.active);
          toggle.classList.toggle('off', !value.active);
          toggle.textContent = value.active ? 'Activa' : 'Inactiva';
        }
        if (quantity && value.quantity) quantity.value = value.quantity;
      } catch (_) {}
    }
    toggle?.addEventListener('click', () => {
      const active = !toggle.classList.contains('on');
      toggle.classList.toggle('on', active);
      toggle.classList.toggle('off', !active);
      toggle.textContent = active ? 'Activa' : 'Inactiva';
    });
    save?.addEventListener('click', () => {
      const active = toggle ? toggle.classList.contains('on') : true;
      const quantityValue = quantity ? Number(quantity.value) : 2;
      localStorage.setItem(`rtm-source-${key}`, JSON.stringify({ active, quantity: quantityValue }));
      save.textContent = 'Guardado ✓';
      setTimeout(() => { save.textContent = 'Actualizar'; }, 1300);
    });
  });
}

// Instalación PWA.
let deferredPrompt;
const installButton = document.querySelector('#install-app');
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  if (installButton) installButton.hidden = false;
});
installButton?.addEventListener('click', async () => {
  if (!deferredPrompt) {
    showToast('En iPhone: Safari → Compartir → Agregar a pantalla de inicio.');
    return;
  }
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installButton.hidden = true;
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(console.warn);
  });
}

// Inicio.
initDynamicContent(document);
loadRiverData();
setInterval(loadRiverData, 30 * 60 * 1000);

if (appShell) {
  const initialRoute = normalizeRoute(location.hash);
  if (!location.hash) history.replaceState(null, '', '#inicio');
  updateActiveNav(initialRoute);
  if (initialRoute !== 'inicio') navigateTo(initialRoute, { scroll: false });
}
