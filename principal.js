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
    renderSocialData(lastSocialData, currentMain);
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
    renderSocialData(lastSocialData, currentMain);
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
// Datos del río: archivo JSON propio, actualizado por GitHub Actions desde el INA.
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
  setText(root, '[data-river-alert-time]', `Registro INA: ${data.official_updated || 'sin horario'}`);
  setText(root, '[data-river-notice]', `Seguimiento prioritario: ${numberAR(data.current)} m, ${trend.toLowerCase()}. Fuente oficial: Instituto Nacional del Agua (INA).`);

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
// Canción actual — dos métodos combinados:
// 1) MÉTODO PRINCIPAL (instantáneo): se consulta cada 8 segundos la API JSON
//    propia del panel de streaming (turadioonline), que informa la canción
//    apenas cambia. El panel indica un mínimo de 5-10 segundos entre consultas.
// 2) MÉTODO DE RESPALDO: si la consulta en vivo falla (por ejemplo, el panel
//    bloquea el acceso directo del navegador), se usa assets/data/cancion.json,
//    que un workflow de GitHub Actions actualiza cada 2 minutos leyendo el
//    metadata ICY del stream. Solo se usa si hace más de 30s que el método
//    en vivo no responde, para no pisar un dato más fresco con uno más viejo.
// -----------------------------------------------------------------------------
const CANCION_API_URL = 'https://miestacion.turadioonline.com.ar/cp/get_info.php?p=8024';
const CANCION_URL = 'assets/data/cancion.json';
const CANCION_STORAGE_KEY = 'rtm-cancion-last-valid';
let lastLiveCancionSuccessAt = 0;

function allRadioNowLabels() {
  return document.querySelectorAll('[data-radio-now]');
}

function renderCancionTexto(texto) {
  if (!texto) return;
  allRadioNowLabels().forEach((el) => { el.textContent = texto; });
}

function renderCancionData(data) {
  if (!data || data.status !== 'ok' || !data.titulo) return;
  const texto = data.artista && data.cancion ? `${data.artista} — ${data.cancion}` : data.titulo;
  renderCancionTexto(texto);
}

function parseTituloCrudo(raw) {
  const texto = String(raw || '').trim();
  for (const sep of [' - ', ' – ', ' — ']) {
    if (texto.includes(sep)) {
      const [artista, cancion] = texto.split(sep);
      return { artista: artista.trim(), cancion: cancion.trim() };
    }
  }
  return { artista: '', cancion: texto };
}

const CANCION_PROXY_URL = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(CANCION_API_URL);

async function fetchJsonConTiempoLimite(url, ms) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function pollCancionEnVivo() {
  let data = null;
  try {
    data = await fetchJsonConTiempoLimite(CANCION_API_URL, 6000);
  } catch (directError) {
    try {
      data = await fetchJsonConTiempoLimite(CANCION_PROXY_URL, 8000);
    } catch (proxyError) {
      // Silencioso: es esperable que falle si el panel bloquea llamadas
      // directas del navegador (CORS) y el intermediario también falla.
      // El respaldo por archivo (cada 2 minutos) se encarga.
      return;
    }
  }

  const titulo = String(data?.title || '').trim();
  if (!titulo) return;

  lastLiveCancionSuccessAt = Date.now();
  const { artista, cancion } = parseTituloCrudo(titulo);
  const texto = artista && cancion ? `${artista} — ${cancion}` : titulo;
  renderCancionTexto(texto);
  localStorage.setItem(CANCION_STORAGE_KEY, JSON.stringify({ status: 'ok', titulo, artista, cancion }));
}

async function loadCancionData() {
  // Si el método en vivo respondió hace poco, no lo pisamos con el archivo
  // de respaldo (que puede tener hasta 2 minutos de demora).
  if (Date.now() - lastLiveCancionSuccessAt < 30 * 1000) return;
  try {
    const response = await fetch(CANCION_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error('Respuesta inválida del archivo de la canción.');
    const data = await response.json();
    if (data.status === 'ok' && data.titulo) {
      localStorage.setItem(CANCION_STORAGE_KEY, JSON.stringify(data));
    }
    renderCancionData(data.status === 'ok' ? data : JSON.parse(localStorage.getItem(CANCION_STORAGE_KEY) || 'null'));
  } catch (error) {
    console.warn(error);
    try {
      const stored = JSON.parse(localStorage.getItem(CANCION_STORAGE_KEY) || 'null');
      if (stored) renderCancionData(stored);
    } catch (_) {}
  }
}


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

function normalizeNewsData(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const rawGroups = Array.isArray(raw.groups) ? raw.groups : (Array.isArray(raw.grupos) ? raw.grupos : []);
  return {
    ...raw,
    updated_at: raw.updated_at || raw.actualizado_en || raw.actualizado || '',
    status: raw.status || raw.estado || '',
    description: raw.description || raw.descripción || '',
    groups: rawGroups.map((group) => {
      const rawItems = Array.isArray(group.items) ? group.items : (Array.isArray(group.elementos) ? group.elementos : []);
      return {
        ...group,
        id: group.id || group.identificación || group.identificacion || '',
        source: group.source || group.fuente || 'Fuente',
        zone: group.zone || group.zona || 'Noticias',
        type: group.type || group.tipo || 'web',
        homepage: group.homepage || group.página_principal || group.pagina_principal || group.source_url || '#',
        items: rawItems.map((item) => ({
          ...item,
          title: item.title || item.título || item.titulo || '',
          link: item.link || item.enlace || '#',
          summary: item.summary || item.resumen || '',
          published: item.published || item.publicado || item.fecha || '',
          source: item.source || item.fuente || group.source || group.fuente || 'Fuente',
          source_url: item.source_url || item.fuente_url || group.homepage || group.página_principal || group.pagina_principal || '#',
          image: item.image || item.imagen || '',
          source_logo: item.source_logo || item.logo_fuente || item.sourceLogo || '',
          source_image: item.source_image || item.imagen_fuente || item.sourceImage || ''
        }))
      };
    })
  };
}
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
      row.className = 'news-page-row';
      const image = document.createElement('img');
      image.className = 'news-page-image';
      image.src = newsImageUrlFor({ ...item, group });
      image.alt = `Imagen de ${item.source || group.source || 'la noticia'}`;
      image.loading = 'lazy';
      applyNewsImageFallback(image, { ...item, group });
      const body = document.createElement('div');
      body.className = 'news-page-copy';
      const strong = document.createElement('strong'); strong.textContent = cleanNewsText(item.title);
      const meta = document.createElement('p'); meta.className = 'muted';
      meta.append(`${formatNewsDate(item.published)} · `, createNewsLink(item));
      body.append(strong, meta);
      if (item.summary) {
        const summary = document.createElement('small'); summary.className = 'news-summary'; summary.textContent = cleanNewsText(item.summary).slice(0, 180);
        body.append(summary);
      }
      row.append(image, body);
      list.append(row);
    });
    const actions = document.createElement('div'); actions.className = 'card-actions';
    const source = document.createElement('a'); source.className = 'btn btn-light'; source.href = group.homepage || '#'; source.target = '_blank'; source.rel = 'noopener'; source.textContent = 'Abrir medio ↗';
    actions.append(source);
    article.append(head, list, actions);
    container.append(article);
  });
}
let homeNewsItems = [];
let homeNewsIndex = 0;
let homeNewsTimer = null;

function newsImageUrlFor(item) {
  const direct = item?.image || item?.source_image || item?.source_logo || '';
  if (direct) return String(direct).replace(/"/g, '');
  const zone = normalizedZone(item?.group?.zone || item?.zone || 'local');
  const images = {
    local: 'assets/img/noticias/local.svg',
    regional: 'assets/img/noticias/regional.svg',
    provincial: 'assets/img/noticias/provincial.svg',
    nacional: 'assets/img/noticias/nacional.svg',
    deportes: 'assets/img/noticias/deportes.svg'
  };
  return images[zone] || images.local;
}

function newsImageFor(item, index = 0) {
  return `url("${newsImageUrlFor(item)}")`;
}

function applyNewsImageFallback(element, item) {
  if (!element) return;
  const fallback = item?.source_logo || (() => {
    const zone = normalizedZone(item?.group?.zone || item?.zone || 'local');
    return `assets/img/noticias/${['local','regional','provincial','nacional','deportes'].includes(zone) ? zone : 'local'}.svg`;
  })();
  if (element.tagName === 'IMG') {
    element.addEventListener('error', () => {
      if (element.dataset.fallbackApplied === '1') return;
      element.dataset.fallbackApplied = '1';
      element.src = fallback;
    }, { once: true });
  }
}

function showHomeNews(index, root = document) {
  if (!homeNewsItems.length) return;
  homeNewsIndex = (index + homeNewsItems.length) % homeNewsItems.length;
  const item = homeNewsItems[homeNewsIndex];
  const lead = root.querySelector('[data-home-news-lead]');
  if (lead) {
    lead.style.backgroundImage = `linear-gradient(180deg,transparent 25%,rgba(10,17,27,.93)),${newsImageFor(item, homeNewsIndex)}`;
    const zone = lead.querySelector('.lead-overlay span');
    const title = lead.querySelector('.lead-overlay h3');
    const meta = lead.querySelector('.lead-overlay small');
    const link = lead.querySelector('.lead-overlay a');
    if (zone) zone.textContent = String(item.group?.zone || 'Noticias').toUpperCase();
    if (title) title.textContent = cleanNewsText(item.title);
    if (meta) meta.textContent = `${item.group?.source || item.source || 'Fuente'} · ${formatNewsDate(item.published)}`;
    if (link) { link.href = item.link || '#noticias'; link.target = item.link ? '_blank' : ''; link.rel = item.link ? 'noopener noreferrer' : ''; }
  }
  root.querySelectorAll('[data-news-dots] button').forEach((dot, dotIndex) => dot.classList.toggle('active', dotIndex === homeNewsIndex));
  const side = root.querySelector('[data-home-news]');
  if (side) {
    side.querySelectorAll('[data-news-index]').forEach(row => row.classList.toggle('active', Number(row.dataset.newsIndex) === homeNewsIndex));
  }
}

function startHomeNewsCarousel(root = document) {
  window.clearInterval(homeNewsTimer);
  if (homeNewsItems.length < 2) return;
  homeNewsTimer = window.setInterval(() => showHomeNews(homeNewsIndex + 1, root), 9000);
}

function renderHomeNews(data, root) {
  const container = root.querySelector('[data-home-news]');
  const dots = root.querySelector('[data-news-dots]');
  if (!container) return;
  homeNewsItems = (data?.groups || []).flatMap(group => (group.items || []).map(item => ({ ...item, group }))).slice(0, 8);
  container.innerHTML = '';
  if (dots) dots.innerHTML = '';
  if (!homeNewsItems.length) {
    container.innerHTML = '<a href="#noticias"><span>NOTICIAS</span><b>Esperando la primera actualización automática</b><small>Las fuentes se revisan aproximadamente cada hora.</small></a>';
    return;
  }
  homeNewsItems.slice(0, 3).forEach((item, index) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'home-news-choice';
    row.dataset.newsIndex = String(index);
    const thumb = document.createElement('span'); thumb.className = 'home-news-thumb'; thumb.style.backgroundImage = newsImageFor(item, index);
    const copy = document.createElement('span'); copy.className = 'home-news-copy';
    const kicker = document.createElement('small'); kicker.textContent = String(item.group?.zone || 'Noticias').toUpperCase();
    const title = document.createElement('b'); title.textContent = cleanNewsText(item.title);
    const source = document.createElement('em'); source.textContent = item.group?.source || item.source || 'Fuente';
    copy.append(kicker, title, source); row.append(thumb, copy);
    row.addEventListener('click', () => { showHomeNews(index, root); startHomeNewsCarousel(root); });
    container.append(row);
  });
  if (dots) homeNewsItems.forEach((_, index) => {
    const dot = document.createElement('button'); dot.type = 'button'; dot.setAttribute('aria-label', `Mostrar noticia ${index + 1}`);
    dot.addEventListener('click', () => { showHomeNews(index, root); startHomeNewsCarousel(root); }); dots.append(dot);
  });
  root.querySelector('[data-news-prev]')?.addEventListener('click', () => { showHomeNews(homeNewsIndex - 1, root); startHomeNewsCarousel(root); });
  root.querySelector('[data-news-next]')?.addEventListener('click', () => { showHomeNews(homeNewsIndex + 1, root); startHomeNewsCarousel(root); });
  const carousel = root.querySelector('[data-news-carousel]');
  carousel?.addEventListener('mouseenter', () => window.clearInterval(homeNewsTimer));
  carousel?.addEventListener('mouseleave', () => startHomeNewsCarousel(root));
  showHomeNews(0, root); startHomeNewsCarousel(root);
}

function renderNewsData(data, root = document) {
  if (!data || !root) return;
  data = normalizeNewsData(data);
  setText(root, '[data-news-updated]', data.updated_at ? `Actualizado: ${formatNewsDate(data.updated_at)}` : 'Esperando primera actualización');
  renderNewsPage(data, root);
  renderHomeNews(data, root);
}
async function loadNewsData() {
  try {
    const response = await fetch(`${NEWS_URL}?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('No respondió el archivo de noticias.');
    const data = await response.json();
    const hasFreshNews = Array.isArray(data?.groups) && data.groups.some(group => Array.isArray(group.items) && group.items.length);
    if (hasFreshNews) {
      lastNewsData = data;
      localStorage.setItem(NEWS_STORAGE_KEY, JSON.stringify(data));
      renderNewsData(data, document);
      return;
    }
    const stored = JSON.parse(localStorage.getItem(NEWS_STORAGE_KEY) || 'null');
    const hasStoredNews = Array.isArray(stored?.groups) && stored.groups.some(group => Array.isArray(group.items) && group.items.length);
    if (hasStoredNews) {
      lastNewsData = stored;
      renderNewsData(stored, document);
      return;
    }
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
// Facebook e Instagram: archivo generado cada 12 horas cuando Meta esté autorizado.
// -----------------------------------------------------------------------------
const SOCIAL_URL = 'assets/data/redes.json';
let lastSocialData = null;
function renderSocialData(data, root = document) {
  const container = root.querySelector('[data-social-news]');
  if (!container) return;
  const items = Array.isArray(data?.items) ? data.items : [];
  container.innerHTML = '';
  if (!items.length) {
    container.innerHTML = '<article class="social-empty"><div>📱</div><h3>Integración preparada</h3><p>Facebook e Instagram se revisarán cada 12 horas cuando conectemos una aplicación oficial de Meta y autoricemos las cuentas.</p><a href="admin-noticias.html" target="_blank" rel="noopener">Administrar fuentes →</a></article>';
    return;
  }
  items.forEach(item => {
    const article = document.createElement('article'); article.className = `social-post ${item.platform || ''}`;
    if (item.image) { const img=document.createElement('img'); img.src=item.image; img.alt=''; img.loading='lazy'; article.append(img); }
    const body=document.createElement('div');
    const top=document.createElement('div'); top.className='social-post-top';
    const platform=document.createElement('span'); platform.textContent=item.platform === 'instagram' ? '◎ Instagram' : 'f Facebook';
    const account=document.createElement('strong'); account.textContent=item.account || 'Cuenta'; top.append(platform,account);
    const text=document.createElement('p'); text.textContent=cleanNewsText(item.text || '').slice(0,260);
    const meta=document.createElement('small'); meta.textContent=formatNewsDate(item.published);
    const link=document.createElement('a'); link.href=item.link || '#'; link.target='_blank'; link.rel='noopener noreferrer'; link.textContent='Ver publicación original ↗';
    body.append(top,text,meta,link); article.append(body); container.append(article);
  });
}
async function loadSocialData() {
  try { const response=await fetch(SOCIAL_URL,{cache:'no-store'}); if(!response.ok) throw new Error('No respondió redes.json'); lastSocialData=await response.json(); renderSocialData(lastSocialData,document); }
  catch(error){ console.warn(error); }
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
      const sourceGrid = root.querySelector('[data-news-sources]');
      const socialSection = root.querySelector('[data-social-section]');
      if (activeNewsFilter === 'redes') {
        if (sourceGrid) sourceGrid.hidden = true;
        if (socialSection) socialSection.hidden = false;
        renderSocialData(lastSocialData, root);
      } else {
        if (sourceGrid) sourceGrid.hidden = false;
        if (socialSection) socialSection.hidden = activeNewsFilter !== 'todas';
        renderNewsData(lastNewsData, root);
      }
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
loadSocialData();
loadCancionData();
pollCancionEnVivo();
setInterval(loadRiverData, 30 * 60 * 1000);
setInterval(loadWeatherData, 15 * 60 * 1000);
setInterval(loadNewsData, 60 * 60 * 1000);
setInterval(loadCancionData, 60 * 1000);
setInterval(pollCancionEnVivo, 8 * 1000);

if (appShell) {
  const initialRoute = normalizeRoute(location.hash);
  if (!location.hash) history.replaceState(null, '', '#inicio');
  updateActiveNav(initialRoute);
  if (initialRoute !== 'inicio') navigateTo(initialRoute, { scroll: false });
}
