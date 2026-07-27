import { firebaseConfig } from './firebase-config.js?v=admin3';

const root = document.querySelector('[data-admin-noticias]');
if (root) initNoticiasAdmin();

const DEFAULT_SOURCES = [
  { id: 'la-piramide', nombre: 'La Pirámide', url: 'https://www.lapiramide.net/', tipo: 'RSS', zona: 'Local', activa: true, cantidad: 2 },
  { id: 'diario-la-calle', nombre: 'Diario La Calle', url: 'https://lacalle.com.ar/', tipo: 'Web', zona: 'Local', activa: true, cantidad: 3 },
  { id: 'andrea-pacinelli', nombre: 'Andrea Pacinelli Noticias', url: 'https://www.facebook.com/andrea.pacinelli.1/', tipo: 'Facebook', zona: 'Local', activa: true, cantidad: 2 },
  { id: 'r2820', nombre: 'R2820', url: 'https://www.r2820.com/', tipo: 'RSS', zona: 'Regional', activa: true, cantidad: 2 },
  { id: 'elonce', nombre: 'Elonce', url: 'https://www.elonce.com/', tipo: 'Web', zona: 'Provincial', activa: false, cantidad: 2 },
  { id: 'pagina-12', nombre: 'Página/12', url: 'https://www.pagina12.com.ar/', tipo: 'RSS', zona: 'Nacional', activa: true, cantidad: 2 }
];

function slugify(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || `fuente-${Date.now()}`;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function toast(message) {
  const box = document.querySelector('.toast');
  if (!box) return;
  box.textContent = message;
  box.classList.add('show');
  clearTimeout(window.__radioTMToast);
  window.__radioTMToast = setTimeout(() => box.classList.remove('show'), 2600);
}

async function initNoticiasAdmin() {
  let firestoreModule;
  let db;

  async function connect(detail) {
    if (!detail?.allowed) return;
    if (!firestoreModule) {
      firestoreModule = await import('https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js');
      db = firestoreModule.getFirestore(detail.app);
    }
    await loadSources(true);
  }

  if (window.RadioTMAdmin) connect(window.RadioTMAdmin);
  window.addEventListener('radiotm-admin-auth', event => connect(event.detail));

  const reloadButton = document.querySelector('#recargar-fuentes');
  reloadButton?.addEventListener('click', () => loadSources(false));

  const form = document.querySelector('#fuente-form');
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!db) return;
    const data = new FormData(form);
    const source = {
      nombre: String(data.get('nombre') || '').trim(),
      url: String(data.get('url') || '').trim(),
      tipo: String(data.get('tipo') || 'Web'),
      zona: String(data.get('zona') || 'Local'),
      cantidad: Math.max(1, Math.min(10, Number(data.get('cantidad') || 2))),
      activa: data.get('activa') === 'on',
      actualizadaEn: firestoreModule.serverTimestamp()
    };
    const id = `${slugify(source.nombre)}-${Date.now().toString().slice(-5)}`;
    try {
      await firestoreModule.setDoc(firestoreModule.doc(db, 'fuentes', id), source);
      form.reset();
      form.querySelector('[name="cantidad"]').value = '2';
      form.querySelector('[name="activa"]').checked = true;
      toast('Fuente agregada correctamente.');
      await loadSources(false);
    } catch (error) {
      console.error(error);
      toast('No se pudo agregar. Revisá las reglas de Firestore.');
    }
  });

  async function seedDefaults() {
    const batch = firestoreModule.writeBatch(db);
    DEFAULT_SOURCES.forEach(source => {
      const { id, ...data } = source;
      batch.set(firestoreModule.doc(db, 'fuentes', id), {
        ...data,
        actualizadaEn: firestoreModule.serverTimestamp()
      });
    });
    await batch.commit();
  }

  async function loadSources(seedIfEmpty) {
    if (!db) return;
    const tbody = document.querySelector('#fuentes-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6">Cargando fuentes…</td></tr>';
    try {
      let snapshot = await firestoreModule.getDocs(firestoreModule.collection(db, 'fuentes'));
      if (snapshot.empty && seedIfEmpty) {
        await seedDefaults();
        snapshot = await firestoreModule.getDocs(firestoreModule.collection(db, 'fuentes'));
      }
      const sources = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => String(a.zona || '').localeCompare(String(b.zona || '')) || String(a.nombre || '').localeCompare(String(b.nombre || '')));
      renderSources(sources);
    } catch (error) {
      console.error(error);
      if (tbody) tbody.innerHTML = '<tr><td colspan="6">No se pudieron leer las fuentes. Publicá las reglas nuevas de Firestore.</td></tr>';
    }
  }

  function renderSources(sources) {
    const tbody = document.querySelector('#fuentes-tbody');
    if (!tbody) return;
    tbody.innerHTML = sources.length ? '' : '<tr><td colspan="6">Todavía no hay fuentes guardadas.</td></tr>';
    sources.forEach(source => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${escapeHtml(source.nombre || 'Sin nombre')}</strong><br><small>${escapeHtml(source.url || '')}</small></td>
        <td>${escapeHtml(source.tipo || 'Web')}</td>
        <td>${escapeHtml(source.zona || 'Local')}</td>
        <td><button class="switch ${source.activa === false ? 'off' : 'on'}" type="button" data-toggle>${source.activa === false ? 'Inactiva' : 'Activa'}</button></td>
        <td><input class="quantity" data-quantity type="number" min="1" max="10" value="${Number(source.cantidad || 2)}"></td>
        <td><div class="admin-row-actions"><button class="btn btn-primary" type="button" data-save>Actualizar</button><button class="btn btn-danger" type="button" data-delete>Eliminar</button></div></td>`;
      let active = source.activa !== false;
      const toggle = row.querySelector('[data-toggle]');
      toggle.addEventListener('click', () => {
        active = !active;
        toggle.className = `switch ${active ? 'on' : 'off'}`;
        toggle.textContent = active ? 'Activa' : 'Inactiva';
      });
      row.querySelector('[data-save]').addEventListener('click', async () => {
        const cantidad = Math.max(1, Math.min(10, Number(row.querySelector('[data-quantity]').value || 2)));
        try {
          await firestoreModule.updateDoc(firestoreModule.doc(db, 'fuentes', source.id), {
            activa: active,
            cantidad,
            actualizadaEn: firestoreModule.serverTimestamp()
          });
          toast(`${source.nombre}: cambios guardados.`);
        } catch (error) {
          console.error(error);
          toast('No se pudo actualizar la fuente.');
        }
      });
      row.querySelector('[data-delete]').addEventListener('click', async () => {
        if (!confirm(`¿Eliminar la fuente ${source.nombre}?`)) return;
        try {
          await firestoreModule.deleteDoc(firestoreModule.doc(db, 'fuentes', source.id));
          toast('Fuente eliminada.');
          await loadSources(false);
        } catch (error) {
          console.error(error);
          toast('No se pudo eliminar la fuente.');
        }
      });
      tbody.appendChild(row);
    });
  }
}
