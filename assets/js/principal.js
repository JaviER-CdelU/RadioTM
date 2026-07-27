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
    renderWeatherData(lastWeatherData, currentMain);
    renderNewsData(lastNewsData, currentMain);
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
    renderWeatherData(lastWeatherData, currentMain);
    renderNewsData(lastNewsData, currentMain);
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
// Clima real: Open-Meteo. Se consulta al abrir y cada 15 minutos.
// -----------------------------------------------------------------------------
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast?latitude=-32.4825&longitude=-58.2372&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=America%2FArgentina%2FBuenos_Aires&forecast_days=4';
const WEATHER_STORAGE_KEY = 'rtm-weather-last-valid';
let lastWeatherData = null;

const WEATHER_CODES = {
  0: ['Despejado', '☀️'], 1: ['Mayormente despejado', '🌤️'], 2: ['Parcialmente nublado', '⛅'],
  3: ['Nublado', '☁️'], 45: ['Niebla', '🌫️'], 48: ['Niebla con escarcha', '🌫️'],
  51: ['Llovizna leve', '🌦️'], 53: ['Llovizna', '🌦️'], 55: ['Llovizna intensa', '🌧️'],
  61: ['Lluvia leve', '🌦️'], 63: ['Lluvia', '🌧️'], 65: ['Lluvia intensa', '🌧️'],
  71: ['Nieve leve', '🌨️'], 73: ['Nieve', '🌨️'], 75: ['Nieve intensa', '🌨️'],
  80: ['Chaparrones leves', '🌦️'], 81: ['Chaparrones', '🌧️'], 82: ['Chaparrones fuertes', '⛈️'],
  95: ['Tormenta', '⛈️'], 96: ['Tormenta con granizo', '⛈️'], 99: ['Tormenta fuerte con granizo', '⛈️']
};

function weatherInfo(code) {
  return WEATHER_CODES[Number(code)] || ['Estado variable', '🌤️'];
}
function roundWeather(value, suffix = '') {
  const n = Number(value);
  return Number.isFinite(n) ? `${Math.round(n)}${suffix}` : '--';
}
function shortTime(value) {
  if (!value) return '--:--';
  const part = String(value).split('T')[1];
  return part ? part.slice(0, 5) : String(value);
}
function shortDay(value, index) {
  if (index === 0) return 'Hoy';
  if (index === 1) return 'Mañana';
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? 'Día' : date.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '');
}
function weatherAlertText(code, precipitation, wind) {
  const c = Number(code); const p = Number(precipitation); const w = Number(wind);
  if ([95, 96, 99].includes(c)) return 'Hay condiciones de tormenta. Seguí los avisos oficiales.';
  if ([65, 82].includes(c) || p >= 10) return 'Se registran lluvias o chaparrones intensos.';
  if (w >= 45) return 'Se registra viento fuerte. Tomá precauciones.';
  return 'Sin alertas meteorológicas automáticas en este momento.';
}
function renderWeatherData(data, root = document) {
  if (!data || !root) return;
  const current = data.current || {};
  const daily = data.daily || {};
  const [description, icon] = weatherInfo(current.weather_code);
  const max = daily.temperature_2m_max?.[0];
  const min = daily.temperature_2m_min?.[0];

  setText(root, '[data-weather-temperature]', roundWeather(current.temperature_2m, '°C'));
  setText(root, '[data-weather-description]', description);
  setText(root, '[data-weather-icon]', icon);
  setText(root, '[data-weather-apparent]', roundWeather(current.apparent_temperature, '°C'));
  setText(root, '[data-weather-humidity]', roundWeather(current.relative_humidity_2m, '%'));
  setText(root, '[data-weather-wind]', roundWeather(current.wind_speed_10m, ' km/h'));
  setText(root, '[data-weather-max]', roundWeather(max, '°C'));
  setText(root, '[data-weather-min]', roundWeather(min, '°C'));
  setText(root, '[data-weather-maxmin]', `${roundWeather(max, '°')} / ${roundWeather(min, '°')}`);
  setText(root, '[data-weather-sunrise]', shortTime(daily.sunrise?.[0]));
  setText(root, '[data-weather-sunset]', shortTime(daily.sunset?.[0]));
  setText(root, '[data-weather-updated]', current.time ? `Actualizado: ${shortTime(current.time)}` : 'Actualizando…');
  setText(root, '[data-weather-alert]', weatherAlertText(current.weather_code, current.precipitation, current.wind_speed_10m));
  setText(root, '[data-weather-alert-time]', current.time ? `Dato meteorológico: ${shortTime(current.time)}` : 'Fuente: Open-Meteo');

  root.querySelectorAll('[data-weather-forecast]').forEach((container) => {
    container.innerHTML = '';
    const days = daily.time || [];
    days.slice(0, 4).forEach((day, index) => {
      const [dayDescription, dayIcon] = weatherInfo(daily.weather_code?.[index]);
      const item = document.createElement('div');
      item.title = dayDescription;
      const label = document.createElement('span');
      label.textContent = `${dayIcon} ${shortDay(day, index)}`;
      const value = document.createElement('b');
      value.textContent = `${roundWeather(daily.temperature_2m_max?.[index], '°')}/${roundWeather(daily.temperature_2m_min?.[index], '°')}`;
      item.append(label, value);
      container.appendChild(item);
    });
  });
}
async function loadWeatherData() {
  try {
    const response = await fetch(WEATHER_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error('No respondió la fuente meteorológica.');
    const data = await response.json();
    if (!Number.isFinite(Number(data?.current?.temperature_2m))) throw new Error('El dato meteorológico no es válido.');
    lastWeatherData = data;
    localStorage.setItem(WEATHER_STORAGE_KEY, JSON.stringify(data));
    renderWeatherData(data, document);
  } catch (error) {
    console.warn(error);
    try {
      const stored = JSON.parse(localStorage.getItem(WEATHER_STORAGE_KEY) || 'null');
      if (stored) { lastWeatherData = stored; renderWeatherData(stored, document); }
    } catch (_) {}
  }
}

// -----------------------------------------------------------------------------
// Noticias: JSON generado cada hora por GitHub Actions.
// Las fuentes activas y la cantidad se leen desde Firebase.
// -----------------------------------------------------------------------------
const NEWS_URL = 'assets/data/noticias.json';
const NEWS_STORAGE_KEY = 'rtm-news-last-valid';
let lastNewsData = null;
let activeNewsFilter = 'todas';

function cleanNewsText(value = '') {
  const div = document.createElement('div');
  div.innerHTML = String(value);
  return (div.textContent || '').replace(/\s+/g, ' ').trim();
}
function formatNewsDate(value) {
  if (!value) return 'Fecha no informada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });
}
function normalizedZone(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
function createNewsLink(item) {
  const link = document.createElement('a');
  link.className = 'source-link';
  link.href = item.link || item.source_url || '#';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Leer en la fuente ↗';
  return link;
}
function renderNewsPage(data, root) {
  const container = root.querySelector('[data-news-sources]');
  if (!container) return;
  const groups = Array.isArray(data?.groups) ? data.groups : [];
  const visible = activeNewsFilter === 'todas' ? groups : groups.filter(group => normalizedZone(group.zone) === activeNewsFilter);
  container.innerHTML = '';
  if (!visible.length) {
    container.innerHTML = '<article class="card"><h2 class="card-title">Actualizando noticias…</h2><p class="muted">El primer proceso automático puede tardar unos minutos después de subir el ZIP. Si una fuente no responde, las demás continúan.</p></article>';
    return;
  }
  visible.forEach((group) => {
    const article = document.createElement('article');
    article.className = 'source-card';
    const head = document.createElement('div'); head.className = 'source-head';
    const title = document.createElement('h3'); title.textContent = group.source || 'Fuente';
    const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = String(group.zone || 'Noticias').toUpperCase();
    head.append(title, tag);
    const list = document.createElement('div'); list.className = 'news-list';
    (group.items || []).forEach((item) => {
      const row = document.createElement('div');
      const strong = document.createElement('strong'); strong.textContent = cleanNewsText(item.title);
      const meta = document.createElement('p'); meta.className = 'muted';
      meta.append(`${formatNewsDate(item.published)} · `, createNewsLink(item));
      row.append(strong, meta);
      if (item.summary) {
        const summary = document.createElement('small'); summary.className = 'news-summary'; summary.textContent = cleanNewsText(item.summary).slice(0, 180);
        row.append(summary);
      }
      list.append(row);
    });
    const actions = document.createElement('div'); actions.className = 'card-actions';
    const source = document.createElement('a'); source.className = 'btn btn-light'; source.href = group.homepage || '#'; source.target = '_blank'; source.rel = 'noopener'; source.textContent = 'Abrir medio ↗';
    actions.append(source);
    article.append(head, list, actions);
    container.append(article);
  });
}
function renderHomeNews(data, root) {
  const container = root.querySelector('[data-home-news]');
  if (!container) return;
  const items = (data?.groups || []).flatMap(group => (group.items || []).map(item => ({ ...item, group }))).slice(0, 3);
  container.innerHTML = '';
  if (!items.length) {
    container.innerHTML = '<div><strong>Esperando la primera actualización automática</strong><p class="muted">Las noticias se revisan aproximadamente cada hora.</p></div>';
    return;
  }
  items.forEach((item, index) => {
    const row = document.createElement('div');
    if (index > 0) row.className = 'news-item';
    if (index > 0) { const thumb = document.createElement('div'); thumb.className = 'thumb'; row.append(thumb); }
    const copy = document.createElement('div');
    if (index === 0) { const kicker = document.createElement('span'); kicker.className = 'section-kicker'; kicker.textContent = String(item.group.zone || 'Noticias').toUpperCase(); copy.append(kicker); }
    const strong = document.createElement('strong'); strong.textContent = cleanNewsText(item.title); copy.append(strong);
    const meta = document.createElement(index === 0 ? 'p' : 'small'); meta.className = index === 0 ? 'muted' : '';
    meta.append(`${item.group.source || item.source || 'Fuente'} · `, createNewsLink(item)); copy.append(meta);
    row.append(copy); container.append(row);
  });
}
function renderNewsData(data, root = document) {
  if (!data || !root) return;
  setText(root, '[data-news-updated]', data.updated_at ? `Actualizado: ${formatNewsDate(data.updated_at)}` : 'Esperando primera actualización');
  renderNewsPage(data, root);
  renderHomeNews(data, root);
}
async function loadNewsData() {
  try {
    const response = await fetch(NEWS_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error('No respondió el archivo de noticias.');
    const data = await response.json();
    lastNewsData = data;
    localStorage.setItem(NEWS_STORAGE_KEY, JSON.stringify(data));
    renderNewsData(data, document);
  } catch (error) {
    console.warn(error);
    try {
      const stored = JSON.parse(localStorage.getItem(NEWS_STORAGE_KEY) || 'null');
      if (stored) { lastNewsData = stored; renderNewsData(stored, document); }
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

  root.querySelectorAll('[data-news-filter]:not([data-ready])').forEach((button) => {
    button.dataset.ready = 'true';
    button.addEventListener('click', () => {
      activeNewsFilter = button.dataset.newsFilter || 'todas';
      root.querySelectorAll('[data-news-filter]').forEach(item => {
        item.classList.toggle('btn-primary', item === button);
        item.classList.toggle('btn-light', item !== button);
      });
      renderNewsData(lastNewsData, root);
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
loadWeatherData();
loadNewsData();
setInterval(loadRiverData, 30 * 60 * 1000);
setInterval(loadWeatherData, 15 * 60 * 1000);
setInterval(loadNewsData, 60 * 60 * 1000);

if (appShell) {
  const initialRoute = normalizeRoute(location.hash);
  if (!location.hash) history.replaceState(null, '', '#inicio');
  updateActiveNav(initialRoute);
  if (initialRoute !== 'inicio') navigateTo(initialRoute, { scroll: false });
}
