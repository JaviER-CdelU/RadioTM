import { FIREBASE_ENABLED, ADMIN_EMAIL, firebaseConfig } from './firebase-config.js?v=firebase5';

const publicSlot = document.querySelector('#publicidad-portada');
const adminRoot = document.querySelector('[data-admin-publicidades]');
const statusBox = document.querySelector('#firebase-status');
const toastBox = document.querySelector('.toast');
const initialPublicSlotHtml = publicSlot?.innerHTML || '';

let toastTimer = null;

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

function safeUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '#';
  } catch (_) {
    return '#';
  }
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
    return 'Storage rechazó la imagen. Falta publicar storage.rules o la cuenta no está autorizada.';
  }
  if (code.includes('storage/object-not-found')) {
    return 'La imagen ya no estaba guardada en Storage.';
  }
  if (code.includes('storage/bucket-not-found') || code.includes('storage/no-default-bucket')) {
    return 'Cloud Storage todavía no está creado para este proyecto.';
  }
  if (code.includes('storage/quota-exceeded') || code.includes('storage/unknown')) {
    return 'No se pudo subir la imagen a Storage. Podés guardar la publicidad sin archivo o usar una URL de imagen.';
  }
  if (code.includes('failed-precondition')) {
    return 'Firestore todavía no está creado o necesita terminar su configuración.';
  }
  if (code.includes('unavailable')) {
    return 'Firebase no respondió. Revisá Internet y volvé a intentar.';
  }

  return `${area} devolvió un error${code ? ` (${code})` : ''}${message ? `: ${message}` : '.'}`;
}

function renderPublicAd(ad) {
  if (!publicSlot) return;
  if (!ad) {
    publicSlot.innerHTML = initialPublicSlotHtml;
    return;
  }

  const href = safeUrl(ad.enlace || '');
  const image = safeUrl(ad.imagenUrl || '');
  publicSlot.innerHTML = `
    <a class="ad-live" href="${href}" ${href === '#' ? '' : 'target="_blank" rel="noopener"'}>
      ${image !== '#' ? `<img src="${image}" alt="Publicidad: ${escapeHtml(ad.titulo || 'Radio Tiempo Muerto')}">` : ''}
      <span class="ad-live-copy"><strong>${escapeHtml(ad.titulo || 'Publicidad')}</strong><small>${escapeHtml(ad.descripcion || 'Conocé esta propuesta.')}</small></span>
    </a>`;
}

async function initFirebase() {
  if (!FIREBASE_ENABLED || !firebaseConfig.apiKey || !firebaseConfig.projectId) {
    if (adminRoot) {
      setStatus('Firebase no recibió la configuración nueva. Actualizá la página o limpiá la caché.', 'warning');
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

    // Portada: escucha en tiempo real las publicidades activas.
    if (publicSlot) {
      const publicQuery = firestoreModule.query(
        firestoreModule.collection(db, 'publicidades'),
        firestoreModule.where('activa', '==', true)
      );

      firestoreModule.onSnapshot(publicQuery, snapshot => {
        const ads = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(ad => !ad.ubicacion || ad.ubicacion === 'portada')
          .sort((a, b) => Number(a.orden || 99) - Number(b.orden || 99));
        renderPublicAd(ads[0] || null);
      }, error => {
        console.error('Error leyendo publicidades públicas:', error);
      });
    }

    if (!adminRoot) return;

    const auth = authModule.getAuth(app);
    const loginButton = document.querySelector('#firebase-login');
    const logoutButton = document.querySelector('#firebase-logout');
    const userLabel = document.querySelector('#firebase-user');
    const form = document.querySelector('#publicidad-form');
    const list = document.querySelector('#publicidades-list');
    const submitButton = document.querySelector('#guardar-publicidad');
    const cancelButton = document.querySelector('#cancelar-edicion');
    const editTitle = document.querySelector('#form-publicidad-titulo');
    const imageBox = document.querySelector('#imagen-actual-box');
    const imagePreview = document.querySelector('#imagen-actual-preview');
    const imageText = document.querySelector('#imagen-actual-texto');
    const removeImageButton = document.querySelector('#quitar-imagen-actual');
    const imageUrlInput = form?.querySelector('[name="imagenUrl"]');
    const fileInput = form?.querySelector('[name="imagen"]');

    let editingId = '';
    let editingAd = null;
    let removeImageRequested = false;

    function resetEditor() {
      editingId = '';
      editingAd = null;
      removeImageRequested = false;
      form?.reset();
      const activeCheckbox = form?.querySelector('[name="activa"]');
      if (activeCheckbox) activeCheckbox.checked = true;
      const orderInput = form?.querySelector('[name="orden"]');
      if (orderInput) orderInput.value = '1';
      if (submitButton) submitButton.textContent = 'Guardar publicidad';
      if (cancelButton) cancelButton.hidden = true;
      if (editTitle) editTitle.textContent = '＋ Cargar publicidad';
      if (imageBox) imageBox.hidden = true;
      if (imagePreview) imagePreview.removeAttribute('src');
      if (imageText) imageText.textContent = '';
    }

    function showCurrentImage(ad) {
      const image = safeUrl(ad?.imagenUrl || '');
      if (!imageBox || image === '#') {
        if (imageBox) imageBox.hidden = true;
        return;
      }
      imageBox.hidden = false;
      if (imagePreview) imagePreview.src = image;
      if (imageText) imageText.textContent = removeImageRequested
        ? 'La imagen se quitará al guardar los cambios.'
        : 'Esta es la imagen que tiene actualmente la publicidad.';
      imageBox.classList.toggle('will-remove', removeImageRequested);
    }

    function startEditing(ad) {
      editingId = ad.id;
      editingAd = ad;
      removeImageRequested = false;

      form.elements.titulo.value = ad.titulo || '';
      form.elements.ubicacion.value = ad.ubicacion || 'portada';
      form.elements.descripcion.value = ad.descripcion || '';
      form.elements.enlace.value = ad.enlace || '';
      form.elements.orden.value = Number(ad.orden || 1);
      form.elements.activa.checked = ad.activa !== false;
      if (imageUrlInput) imageUrlInput.value = ad.imagenUrl || '';
      if (fileInput) fileInput.value = '';

      if (submitButton) submitButton.textContent = 'Actualizar publicidad';
      if (cancelButton) cancelButton.hidden = false;
      if (editTitle) editTitle.textContent = '✏️ Modificar publicidad';
      showCurrentImage(ad);
      form.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      notify(`Editando: ${ad.titulo || 'Publicidad'}. Hacé los cambios y tocá “Actualizar publicidad”.`, 'info');
    }

    async function getStorageModule() {
      return import('https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js');
    }

    async function deleteStoredImage(ad) {
      if (!ad?.imagenPath && !ad?.imagenUrl) return '';
      try {
        const storageModule = await getStorageModule();
        const storage = storageModule.getStorage(app);
        const imageRef = storageModule.ref(storage, ad.imagenPath || ad.imagenUrl);
        await storageModule.deleteObject(imageRef);
        return '';
      } catch (error) {
        const code = String(error?.code || '').toLowerCase();
        // Si era una URL externa o el archivo ya no existe, la publicidad igual puede quedar sin imagen.
        if (code.includes('storage/object-not-found') || code.includes('storage/invalid-url')) return '';
        console.warn('No se pudo borrar el archivo físico de Storage:', error);
        return firebaseErrorText(error, 'Storage');
      }
    }

    async function removeImageFromAd(ad) {
      if (!confirm(`¿Quitar la imagen de “${ad.titulo || 'esta publicidad'}”? La publicidad seguirá guardada.`)) return;
      try {
        setStatus('Quitando imagen…', 'info');
        await firestoreModule.updateDoc(firestoreModule.doc(db, 'publicidades', ad.id), {
          imagenUrl: '',
          imagenPath: '',
          actualizadaEn: firestoreModule.serverTimestamp()
        });
        const cleanupWarning = await deleteStoredImage(ad);
        notify(cleanupWarning
          ? `Imagen quitada de la publicidad. ${cleanupWarning}`
          : 'Imagen quitada correctamente. La publicidad quedó guardada sin imagen.',
        cleanupWarning ? 'warning' : 'success');
        await loadAds();
      } catch (error) {
        setStatus(firebaseErrorText(error, 'Firestore'), 'error', true);
      }
    }

    async function loadAds() {
      if (!list) return;
      list.innerHTML = '<p class="muted">Leyendo publicidades…</p>';
      try {
        const snapshot = await firestoreModule.getDocs(firestoreModule.collection(db, 'publicidades'));
        const ads = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => Number(a.orden || 99) - Number(b.orden || 99));

        list.innerHTML = ads.length ? '' : '<p class="muted">Todavía no hay publicidades guardadas.</p>';
        ads.forEach(ad => {
          const item = document.createElement('article');
          item.className = 'ad-admin-item';
          const image = safeUrl(ad.imagenUrl || '');
          item.innerHTML = `
            ${image !== '#' ? `<img src="${image}" alt="${escapeHtml(ad.titulo || 'Publicidad')}">` : '<div class="ad-admin-noimage">Sin imagen</div>'}
            <div><strong>${escapeHtml(ad.titulo || 'Publicidad sin título')}</strong><small>${escapeHtml(ad.ubicacion || 'portada')} · orden ${Number(ad.orden || 1)}</small><span>${ad.activa === false ? 'Inactiva' : 'Activa'}</span></div>
            <div class="ad-admin-actions">
              <button type="button" class="btn btn-light" data-ad-edit>Editar</button>
              ${image !== '#' ? '<button type="button" class="btn btn-light" data-ad-remove-image>Quitar imagen</button>' : ''}
              <button type="button" class="btn btn-light" data-ad-toggle>${ad.activa === false ? 'Activar' : 'Desactivar'}</button>
              <button type="button" class="btn btn-danger" data-ad-delete>Eliminar</button>
            </div>`;

          item.querySelector('[data-ad-edit]')?.addEventListener('click', () => startEditing(ad));
          item.querySelector('[data-ad-remove-image]')?.addEventListener('click', () => removeImageFromAd(ad));

          item.querySelector('[data-ad-toggle]')?.addEventListener('click', async () => {
            try {
              const nextActive = ad.activa === false;
              await firestoreModule.updateDoc(firestoreModule.doc(db, 'publicidades', ad.id), {
                activa: nextActive,
                actualizadaEn: firestoreModule.serverTimestamp()
              });
              notify(nextActive
                ? 'Publicidad activada. Si está ubicada en Portada, ya puede verse en la página.'
                : 'Publicidad desactivada. Ya no se mostrará en la página.', 'success');
              await loadAds();
            } catch (error) {
              setStatus(firebaseErrorText(error, 'Firestore'), 'error', true);
            }
          });

          item.querySelector('[data-ad-delete]')?.addEventListener('click', async () => {
            if (!confirm(`¿Eliminar definitivamente “${ad.titulo || 'esta publicidad'}”?`)) return;
            try {
              setStatus('Eliminando publicidad…', 'info');
              await firestoreModule.deleteDoc(firestoreModule.doc(db, 'publicidades', ad.id));
              const cleanupWarning = await deleteStoredImage(ad);
              if (editingId === ad.id) resetEditor();
              notify(cleanupWarning
                ? `Publicidad eliminada. ${cleanupWarning}`
                : 'Publicidad eliminada correctamente.',
              cleanupWarning ? 'warning' : 'success');
              await loadAds();
            } catch (error) {
              setStatus(firebaseErrorText(error, 'Firestore'), 'error', true);
            }
          });
          list.appendChild(item);
        });
      } catch (error) {
        console.error('Error leyendo publicidades:', error);
        list.innerHTML = '<p class="muted">No se pudieron leer las publicidades.</p>';
        setStatus(firebaseErrorText(error, 'Firestore'), 'error', true);
      }
    }

    removeImageButton?.addEventListener('click', () => {
      if (!editingAd?.imagenUrl) return;
      removeImageRequested = true;
      if (imageUrlInput) imageUrlInput.value = '';
      if (fileInput) fileInput.value = '';
      showCurrentImage(editingAd);
      notify('La imagen se quitará cuando presiones “Actualizar publicidad”.', 'info');
    });

    imageUrlInput?.addEventListener('input', () => {
      if (!editingAd?.imagenUrl) return;
      removeImageRequested = imageUrlInput.value.trim() === '' && !(fileInput?.files?.[0]);
      showCurrentImage(editingAd);
    });

    fileInput?.addEventListener('change', () => {
      if (fileInput.files?.[0]) {
        removeImageRequested = false;
        if (imageText) imageText.textContent = 'La imagen nueva reemplazará a la actual cuando guardes.';
        if (imageBox) imageBox.classList.remove('will-remove');
      }
    });

    cancelButton?.addEventListener('click', () => {
      resetEditor();
      notify('Edición cancelada. No se modificó la publicidad.', 'info');
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
        setStatus(`La cuenta ${user.email} no está autorizada para administrar publicidades.`, 'error', true);
        await authModule.signOut(auth);
        return;
      }

      if (userLabel) userLabel.textContent = allowed ? `Conectado: ${user.email}` : 'No has iniciado sesión';
      if (loginButton) {
        loginButton.hidden = allowed;
        loginButton.style.display = allowed ? 'none' : '';
      }
      if (logoutButton) {
        logoutButton.hidden = !allowed;
        logoutButton.style.display = allowed ? '' : 'none';
      }
      adminRoot.querySelectorAll('input, select, textarea, button[type="submit"]').forEach(el => { el.disabled = !allowed; });
      if (cancelButton) cancelButton.disabled = !allowed;
      if (removeImageButton) removeImageButton.disabled = !allowed;

      if (allowed) {
        setStatus('Firebase conectado. Ya podés crear, modificar, activar y borrar publicidades.', 'success');
        await loadAds();
      } else {
        resetEditor();
        if (list) list.innerHTML = '<p class="muted">Iniciá sesión para ver las publicidades.</p>';
        setStatus('Iniciá sesión con la cuenta administradora para modificar publicidades.', 'info');
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
      const file = data.get('imagen');
      const typedImageUrl = String(data.get('imagenUrl') || '').trim();
      const oldAd = editingAd ? { ...editingAd } : null;
      let imagenUrl = editingAd?.imagenUrl || '';
      let imagenPath = editingAd?.imagenPath || '';
      let imageWarning = '';
      let replacedOldImage = false;

      try {
        if (submitButton) submitButton.disabled = true;
        setStatus(editingId ? 'Actualizando publicidad…' : 'Guardando publicidad…', 'info');

        if (removeImageRequested || (editingAd?.imagenUrl && !typedImageUrl && !(file && file.size))) {
          imagenUrl = '';
          imagenPath = '';
          replacedOldImage = true;
        } else if (file && file.size) {
          try {
            setStatus('Subiendo imagen nueva…', 'info');
            const storageModule = await getStorageModule();
            const storage = storageModule.getStorage(app);
            const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
            imagenPath = `publicidades/${Date.now()}-${cleanName}`;
            const fileRef = storageModule.ref(storage, imagenPath);
            await storageModule.uploadBytes(fileRef, file, { contentType: file.type });
            imagenUrl = await storageModule.getDownloadURL(fileRef);
            replacedOldImage = Boolean(oldAd?.imagenUrl);
          } catch (error) {
            console.error('No se pudo subir la imagen:', error);
            imageWarning = firebaseErrorText(error, 'Storage');
            // Si se estaba editando, conservar la imagen anterior; si es nueva, usar la URL escrita.
            imagenUrl = oldAd?.imagenUrl || typedImageUrl;
            imagenPath = oldAd?.imagenPath || '';
          }
        } else if (typedImageUrl !== (editingAd?.imagenUrl || '')) {
          imagenUrl = typedImageUrl;
          imagenPath = '';
          replacedOldImage = Boolean(oldAd?.imagenUrl && oldAd.imagenUrl !== typedImageUrl);
        }

        const payload = {
          titulo: String(data.get('titulo') || '').trim(),
          descripcion: String(data.get('descripcion') || '').trim(),
          enlace: String(data.get('enlace') || '').trim(),
          ubicacion: String(data.get('ubicacion') || 'portada'),
          orden: Number(data.get('orden') || 1),
          activa: data.get('activa') === 'on',
          imagenUrl,
          imagenPath,
          actualizadaEn: firestoreModule.serverTimestamp(),
          actualizadaPor: user.email
        };

        if (editingId) {
          await firestoreModule.updateDoc(firestoreModule.doc(db, 'publicidades', editingId), payload);
        } else {
          await firestoreModule.addDoc(firestoreModule.collection(db, 'publicidades'), {
            ...payload,
            creadaEn: firestoreModule.serverTimestamp(),
            creadaPor: user.email
          });
        }

        let cleanupWarning = '';
        if (oldAd && replacedOldImage && (oldAd.imagenPath || oldAd.imagenUrl)) {
          cleanupWarning = await deleteStoredImage(oldAd);
        }

        const wasEditing = Boolean(editingId);
        const isVisibleNow = payload.activa && payload.ubicacion === 'portada';
        resetEditor();

        let successMessage = wasEditing ? 'Publicidad actualizada correctamente.' : 'Publicidad guardada correctamente.';
        if (isVisibleNow) successMessage += ' Ya quedó activa para mostrarse en la portada.';
        else if (!payload.activa) successMessage += ' Quedó guardada como inactiva.';
        else successMessage += ` Quedó destinada a la sección ${payload.ubicacion}.`;

        if (imageWarning && !imagenUrl) {
          notify(`${successMessage} Se guardó sin imagen. ${imageWarning}`, 'warning');
        } else if (cleanupWarning) {
          notify(`${successMessage} ${cleanupWarning}`, 'warning');
        } else {
          notify(successMessage, 'success');
        }
        await loadAds();
      } catch (error) {
        console.error('No se pudo guardar la publicidad:', error);
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
