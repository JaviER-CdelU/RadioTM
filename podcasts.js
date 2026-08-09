import { FIREBASE_ENABLED, ADMIN_EMAIL, firebaseConfig } from './firebase-config.js?v=firebase5';

const adminRoot = document.querySelector('[data-admin-podcasts]');
const statusBox = document.querySelector('#firebase-status');
const toastBox = document.querySelector('.toast');

let toastTimer = null;
let latestPublicPodcasts = null;

function showToast(message, kind = 'success') {
  if (!toastBox) return;
  toastBox.textContent = message;
  toastBox.dataset.kind = kind;
  toastBox.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastBox.classList.remove('show'), 4500);
}

function setStatus(message, kind = 'info', announce = false) {
  if (statusBox) {
    statusBox.textContent = message;
    statusBox.dataset.kind = kind;
    statusBox.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }
  if (announce) showToast(message, kind);
}

function notify(message, kind = 'success') {
  setStatus(message, kind, true);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function firebaseErrorText(error, area = 'Firebase') {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '');

  if (code.includes('permission-denied')) {
    return 'Firestore rechazó el acceso. Falta pegar y PUBLICAR las reglas de firestore.rules en Firebase → Firestore Database → Reglas.';
  }
  if (code.includes('auth/unauthorized-domain')) {
    return 'El dominio no está autorizado. Agregá javier-cdelu.github.io en Firebase → Authentication → Configuración → Dominios autorizados.';
  }
  if (code.includes('auth/popup-blocked')) {
    return 'El navegador bloqueó la ventana de Google. Permití ventanas emergentes y volvé a intentar.';
  }
  if (code.includes('storage/unauthorized')) {
    return 'Storage rechazó el archivo. Falta publicar storage.rules o la cuenta no está autorizada.';
  }
  if (code.includes('storage/bucket-not-found') || code.includes('storage/no-default-bucket')) {
    return 'Cloud Storage todavía no está creado para este proyecto.';
  }
  if (code.includes('storage/quota-exceeded') || code.includes('storage/unknown')) {
    return 'No se pudo subir el audio a Storage. Probá con un archivo más liviano.';
  }
  if (code.includes('failed-precondition')) {
    return 'Firestore todavía no está creado o necesita terminar su configuración.';
  }
  if (code.includes('unavailable')) {
    return 'Firebase no respondió. Revisá Internet y volvé a intentar.';
  }

  return `${area} devolvió un error${code ? ` (${code})` : ''}${message ? `: ${message}` : '.'}`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function renderPublicPodcasts(podcasts) {
  const container = document.querySelector('[data-podcasts-list]');
  if (!container) return;
  if (!podcasts.length) {
    container.innerHTML = '<p class="muted">Todavía no hay episodios subidos. Muy pronto vas a poder escuchar acá los programas grabados.</p>';
    return;
  }
  container.innerHTML = podcasts.map(p => `
    <article class="podcast-episode-card">
      <div class="podcast-episode-head">
        <span class="podcast-episode-tag">${escapeHtml(p.programa || 'Podcast')}</span>
        <h3>${escapeHtml(p.titulo || 'Episodio sin título')}</h3>
        ${p.descripcion ? `<p class="muted">${escapeHtml(p.descripcion)}</p>` : ''}
      </div>
      ${p.audioUrl ? `<audio controls preload="none" src="${p.audioUrl}"></audio>` : '<p class="muted">Audio no disponible.</p>'}
    </article>`).join('');
}

// El sitio navega como SPA: cuando se llega a "Podcasts" haciendo clic desde otra
// página, el <main> se reemplaza por atrás sin recargar este script. Este observer
// detecta cuando aparece el contenedor de la lista y la vuelve a pintar con el
// último dato que ya tengamos guardado, sin esperar la próxima actualización de Firestore.
new MutationObserver(() => {
  if (latestPublicPodcasts && document.querySelector('[data-podcasts-list]')) {
    renderPublicPodcasts(latestPublicPodcasts);
  }
}).observe(document.body, { childList: true, subtree: true });

async function initFirebase() {
  if (!FIREBASE_ENABLED || !firebaseConfig.apiKey || !firebaseConfig.projectId) {
    if (adminRoot) {
      setStatus('Firebase no recibió la configuración. Actualizá la página o limpiá la caché.', 'warning');
      adminRoot.querySelectorAll('input, select, textarea, button[type="submit"]').forEach(el => { el.disabled = true; });
    }
    return;
  }

  try {
    const [{ initializeApp }, firestoreModule, authModule] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js'),
      import('https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js')
    ]);

    const app = initializeApp(firebaseConfig);
    const db = firestoreModule.getFirestore(app);

    {
      const publicQuery = firestoreModule.query(
        firestoreModule.collection(db, 'podcasts'),
        firestoreModule.where('activo', '==', true)
      );
      firestoreModule.onSnapshot(publicQuery, snapshot => {
        latestPublicPodcasts = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => Number(a.orden ?? 99) - Number(b.orden ?? 99));
        renderPublicPodcasts(latestPublicPodcasts);
      }, error => {
        console.error('Error leyendo podcasts públicos:', error);
        const container = document.querySelector('[data-podcasts-list]');
        if (container) container.innerHTML = '<p class="muted">No se pudieron cargar los episodios en este momento.</p>';
      });
    }

    if (!adminRoot) return;

    const auth = authModule.getAuth(app);
    const loginButton = document.querySelector('#firebase-login');
    const logoutButton = document.querySelector('#firebase-logout');
    const userLabel = document.querySelector('#firebase-user');
    const form = document.querySelector('#podcast-form');
    const list = document.querySelector('#podcasts-list');
    const submitButton = document.querySelector('#guardar-podcast');
    const cancelButton = document.querySelector('#cancelar-edicion-podcast');
    const editTitle = document.querySelector('#form-podcast-titulo');
    const fileInput = form?.querySelector('[name="audio"]');
    const currentAudioBox = document.querySelector('#audio-actual-box');
    const currentAudioText = document.querySelector('#audio-actual-texto');

    let editingId = '';
    let editingPodcast = null;

    function resetEditor() {
      editingId = '';
      editingPodcast = null;
      form?.reset();
      const activeCheckbox = form?.querySelector('[name="activo"]');
      if (activeCheckbox) activeCheckbox.checked = true;
      const orderInput = form?.querySelector('[name="orden"]');
      if (orderInput) orderInput.value = '1';
      if (submitButton) submitButton.textContent = 'Guardar episodio';
      if (cancelButton) cancelButton.hidden = true;
      if (editTitle) editTitle.textContent = '＋ Cargar episodio';
      if (currentAudioBox) currentAudioBox.hidden = true;
      if (fileInput) fileInput.required = true;
    }

    function startEditing(p) {
      editingId = p.id;
      editingPodcast = p;
      form.elements.titulo.value = p.titulo || '';
      form.elements.programa.value = p.programa || '';
      form.elements.descripcion.value = p.descripcion || '';
      form.elements.orden.value = Number(p.orden ?? 1);
      form.elements.activo.checked = p.activo !== false;
      if (fileInput) { fileInput.value = ''; fileInput.required = false; }
      if (currentAudioBox) {
        currentAudioBox.hidden = false;
        if (currentAudioText) currentAudioText.textContent = p.audioUrl ? 'Ya tiene un audio cargado. Subí uno nuevo solo si querés reemplazarlo.' : 'Todavía no tiene audio cargado.';
      }
      if (submitButton) submitButton.textContent = 'Actualizar episodio';
      if (cancelButton) cancelButton.hidden = false;
      if (editTitle) editTitle.textContent = '✏️ Modificar episodio';
      form.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      notify(`Editando: ${p.titulo || 'episodio'}. Hacé los cambios y tocá “Actualizar episodio”.`, 'info');
    }

    async function getStorageModule() {
      return import('https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js');
    }

    async function deleteStoredAudio(p) {
      if (!p?.audioPath) return '';
      try {
        const storageModule = await getStorageModule();
        const storage = storageModule.getStorage(app);
        await storageModule.deleteObject(storageModule.ref(storage, p.audioPath));
        return '';
      } catch (error) {
        const code = String(error?.code || '').toLowerCase();
        if (code.includes('storage/object-not-found')) return '';
        console.warn('No se pudo borrar el audio de Storage:', error);
        return firebaseErrorText(error, 'Storage');
      }
    }

    async function loadPodcasts() {
      if (!list) return;
      list.innerHTML = '<p class="muted">Leyendo episodios…</p>';
      try {
        const snapshot = await firestoreModule.getDocs(firestoreModule.collection(db, 'podcasts'));
        const podcasts = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => Number(a.orden ?? 99) - Number(b.orden ?? 99));

        list.innerHTML = podcasts.length ? '' : '<p class="muted">Todavía no hay episodios cargados.</p>';
        podcasts.forEach(p => {
          const item = document.createElement('article');
          item.className = 'ad-admin-item';
          item.innerHTML = `
            <div class="ad-admin-noimage">🎧</div>
            <div><strong>${escapeHtml(p.titulo || 'Episodio sin título')}</strong><small>${escapeHtml(p.programa || 'Podcast')} · orden ${Number(p.orden ?? 1)}</small><span>${p.activo === false ? 'Inactivo' : 'Activo'}</span></div>
            <div class="ad-admin-actions">
              <button type="button" class="btn btn-light" data-pod-edit>Editar</button>
              <button type="button" class="btn btn-light" data-pod-toggle>${p.activo === false ? 'Activar' : 'Desactivar'}</button>
              <button type="button" class="btn btn-danger" data-pod-delete>Eliminar</button>
            </div>`;

          item.querySelector('[data-pod-edit]')?.addEventListener('click', () => startEditing(p));

          item.querySelector('[data-pod-toggle]')?.addEventListener('click', async () => {
            try {
              const nextActive = p.activo === false;
              await firestoreModule.updateDoc(firestoreModule.doc(db, 'podcasts', p.id), {
                activo: nextActive,
                actualizadoEn: firestoreModule.serverTimestamp()
              });
              notify(nextActive ? 'Episodio activado, ya se muestra en la página de Podcasts.' : 'Episodio desactivado.', 'success');
              await loadPodcasts();
            } catch (error) {
              setStatus(firebaseErrorText(error, 'Firestore'), 'error', true);
            }
          });

          item.querySelector('[data-pod-delete]')?.addEventListener('click', async () => {
            if (!confirm(`¿Eliminar definitivamente “${p.titulo || 'este episodio'}”?`)) return;
            try {
              setStatus('Eliminando episodio…', 'info');
              await firestoreModule.deleteDoc(firestoreModule.doc(db, 'podcasts', p.id));
              const cleanupWarning = await deleteStoredAudio(p);
              if (editingId === p.id) resetEditor();
              notify(cleanupWarning ? `Episodio eliminado. ${cleanupWarning}` : 'Episodio eliminado correctamente.', cleanupWarning ? 'warning' : 'success');
              await loadPodcasts();
            } catch (error) {
              setStatus(firebaseErrorText(error, 'Firestore'), 'error', true);
            }
          });
          list.appendChild(item);
        });
      } catch (error) {
        console.error('Error leyendo podcasts:', error);
        list.innerHTML = '<p class="muted">No se pudieron leer los episodios.</p>';
        setStatus(firebaseErrorText(error, 'Firestore'), 'error', true);
      }
    }

    cancelButton?.addEventListener('click', () => {
      resetEditor();
      notify('Edición cancelada. No se modificó el episodio.', 'info');
    });

    loginButton?.addEventListener('click', async () => {
      const provider = new authModule.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try {
        await authModule.signInWithPopup(auth, provider);
      } catch (error) {
        console.error(error);
        setStatus(firebaseErrorText(error, 'Authentication'), 'error', true);
      }
    });

    logoutButton?.addEventListener('click', async () => {
      await authModule.signOut(auth);
      notify('Sesión cerrada.', 'info');
    });

    authModule.onAuthStateChanged(auth, async user => {
      const allowed = Boolean(user && user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase());
      if (user && !allowed) {
        setStatus(`La cuenta ${user.email} no está autorizada para administrar podcasts.`, 'error', true);
        await authModule.signOut(auth);
        return;
      }

      if (userLabel) userLabel.textContent = allowed ? `Conectado: ${user.email}` : 'No has iniciado sesión';
      if (loginButton) { loginButton.hidden = allowed; loginButton.style.display = allowed ? 'none' : ''; }
      if (logoutButton) { logoutButton.hidden = !allowed; logoutButton.style.display = allowed ? '' : 'none'; }
      adminRoot.querySelectorAll('input, select, textarea, button[type="submit"]').forEach(el => { el.disabled = !allowed; });
      if (cancelButton) cancelButton.disabled = !allowed;

      if (allowed) {
        setStatus('Firebase conectado. Ya podés subir, modificar, activar y borrar episodios.', 'success');
        await loadPodcasts();
      } else {
        resetEditor();
        if (list) list.innerHTML = '<p class="muted">Iniciá sesión para ver los episodios.</p>';
        setStatus('Iniciá sesión con la cuenta administradora para cargar episodios.', 'info');
      }
    });

    form?.addEventListener('submit', async event => {
      event.preventDefault();
      const user = auth.currentUser;
      if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        setStatus('Primero iniciá sesión con la cuenta administradora.', 'error', true);
        return;
      }

      const data = new FormData(form);
      const file = data.get('audio');
      const oldPodcast = editingPodcast ? { ...editingPodcast } : null;
      let audioUrl = editingPodcast?.audioUrl || '';
      let audioPath = editingPodcast?.audioPath || '';
      let audioWarning = '';

      if (!editingId && (!file || !file.size)) {
        setStatus('Elegí un archivo de audio antes de guardar.', 'error', true);
        return;
      }

      try {
        if (submitButton) submitButton.disabled = true;
        setStatus(editingId ? 'Actualizando episodio…' : 'Guardando episodio…', 'info');

        if (file && file.size) {
          try {
            setStatus('Subiendo audio… esto puede tardar unos segundos según el tamaño del archivo.', 'info');
            const storageModule = await getStorageModule();
            const storage = storageModule.getStorage(app);
            const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
            const newPath = `podcasts/${Date.now()}-${cleanName}`;
            const fileRef = storageModule.ref(storage, newPath);
            await storageModule.uploadBytes(fileRef, file, { contentType: file.type });
            const newUrl = await storageModule.getDownloadURL(fileRef);
            if (oldPodcast?.audioPath) await deleteStoredAudio(oldPodcast);
            audioUrl = newUrl;
            audioPath = newPath;
          } catch (error) {
            console.error('No se pudo subir el audio:', error);
            audioWarning = firebaseErrorText(error, 'Storage');
            audioUrl = oldPodcast?.audioUrl || '';
            audioPath = oldPodcast?.audioPath || '';
          }
        }

        const payload = {
          titulo: String(data.get('titulo') || '').trim(),
          programa: String(data.get('programa') || '').trim(),
          descripcion: String(data.get('descripcion') || '').trim(),
          orden: Number(data.get('orden') || 1),
          activo: data.get('activo') === 'on',
          audioUrl,
          audioPath,
          actualizadoEn: firestoreModule.serverTimestamp(),
          actualizadoPor: user.email
        };

        if (editingId) {
          await firestoreModule.updateDoc(firestoreModule.doc(db, 'podcasts', editingId), payload);
        } else {
          await firestoreModule.addDoc(firestoreModule.collection(db, 'podcasts'), {
            ...payload,
            creadoEn: firestoreModule.serverTimestamp(),
            creadoPor: user.email
          });
        }

        const wasEditing = Boolean(editingId);
        resetEditor();
        let successMessage = wasEditing ? 'Episodio actualizado correctamente.' : 'Episodio guardado correctamente.';
        if (audioWarning) notify(`${successMessage} ${audioWarning}`, 'warning');
        else notify(successMessage, 'success');
        await loadPodcasts();
      } catch (error) {
        console.error('No se pudo guardar el episodio:', error);
        setStatus(firebaseErrorText(error, 'Firestore'), 'error', true);
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  } catch (error) {
    console.error(error);
    setStatus(firebaseErrorText(error, 'Firebase'), 'error', true);
  }
}

initFirebase();
