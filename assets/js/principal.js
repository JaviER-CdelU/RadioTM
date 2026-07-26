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
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2600);
}
window.rtmShowToast = showToast;

// Reproductor real de Radio Tiempo Muerto.
const radioAudio = document.querySelector('#radio-stream');
const radioPlay = document.querySelector('#radio-play');
const radioLabel = document.querySelector('#radio-label');
const radioStatus = document.querySelector('#radio-status');

function setRadioState(state, message) {
  if (!radioPlay || !radioLabel || !radioStatus) return;
  radioPlay.classList.toggle('is-loading', state === 'loading');
  radioPlay.classList.toggle('is-playing', state === 'playing');
  if (state === 'playing') {
    radioPlay.textContent = '❚❚';
    radioPlay.setAttribute('aria-label', 'Pausar Radio Tiempo Muerto');
    radioLabel.textContent = '🔊 RADIO EN VIVO';
  } else if (state === 'loading') {
    radioPlay.textContent = '…';
    radioLabel.textContent = 'CONECTANDO…';
  } else {
    radioPlay.textContent = '▶';
    radioPlay.setAttribute('aria-label', 'Reproducir Radio Tiempo Muerto');
    radioLabel.textContent = '🔊 TOCAR PARA ESCUCHAR';
  }
  radioStatus.textContent = message;
}

if (radioAudio && radioPlay) {
  radioPlay.addEventListener('click', async () => {
    if (!radioAudio.paused) {
      radioAudio.pause();
      setRadioState('paused', 'Transmisión pausada. Tocá ▶ para volver a escuchar.');
      return;
    }
    setRadioState('loading', 'Conectando con el servidor de la radio…');
    try {
      // Volver a cargar ayuda cuando el servidor estuvo fuera de línea.
      if (radioAudio.error) radioAudio.load();
      await radioAudio.play();
      setRadioState('playing', 'Estás escuchando Radio Tiempo Muerto en vivo.');
    } catch (error) {
      setRadioState('stopped', 'La señal no está emitiendo en este momento. Probá nuevamente cuando la radio esté al aire.');
      showToast('No se pudo iniciar la señal. Puede estar fuera de línea.');
    }
  });
  radioAudio.addEventListener('playing', () => setRadioState('playing', 'Estás escuchando Radio Tiempo Muerto en vivo.'));
  radioAudio.addEventListener('waiting', () => setRadioState('loading', 'Esperando datos de la transmisión…'));
  radioAudio.addEventListener('stalled', () => setRadioState('loading', 'La conexión está lenta. Intentando reconectar…'));
  radioAudio.addEventListener('error', () => {
    setRadioState('stopped', 'La señal no está emitiendo en este momento. Probá nuevamente cuando la radio esté al aire.');
  });
}

// Botones visuales de podcasts, todavía sin audios cargados.
document.querySelectorAll('.mini-play').forEach((button) => {
  button.addEventListener('click', () => {
    const playing = button.dataset.playing === 'true';
    button.dataset.playing = String(!playing);
    button.textContent = playing ? '▶' : '❚❚';
    showToast('Este podcast se conectará cuando tengamos el archivo de audio.');
  });
});

document.querySelectorAll('[data-demo]').forEach((el) => {
  el.addEventListener('click', (event) => {
    if (el.tagName === 'A' && el.getAttribute('href') !== '#') return;
    event.preventDefault();
    showToast(el.dataset.demo || 'Función preparada para conectar.');
  });
});

// Administrador visual de fuentes: guarda los ajustes en este navegador.
document.querySelectorAll('[data-source-row]').forEach((row) => {
  const key = row.dataset.sourceRow;
  const toggle = row.querySelector('[data-toggle]');
  const quantity = row.querySelector('[data-quantity]');
  const save = row.querySelector('[data-save]');
  const stored = localStorage.getItem('rtm-source-' + key);
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
  if (toggle) toggle.addEventListener('click', () => {
    const active = !toggle.classList.contains('on');
    toggle.classList.toggle('on', active);
    toggle.classList.toggle('off', !active);
    toggle.textContent = active ? 'Activa' : 'Inactiva';
  });
  if (save) save.addEventListener('click', () => {
    const active = toggle ? toggle.classList.contains('on') : true;
    const qty = quantity ? Number(quantity.value) : 2;
    localStorage.setItem('rtm-source-' + key, JSON.stringify({active, quantity: qty}));
    save.textContent = 'Guardado ✓';
    setTimeout(() => save.textContent = 'Actualizar', 1300);
  });
});

let deferredPrompt;
const installButton = document.querySelector('#install-app');
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  if (installButton) installButton.hidden = false;
});
if (installButton) {
  installButton.addEventListener('click', async () => {
    if (!deferredPrompt) {
      showToast('En iPhone: Safari → Compartir → Agregar a pantalla de inicio.');
      return;
    }
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installButton.hidden = true;
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  });
}
