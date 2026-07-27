import { FIREBASE_ENABLED, ADMIN_EMAIL, firebaseConfig } from './firebase-config.js?v=firebase4';

const publicSlot = document.querySelector('#publicidad-portada');
const adminRoot = document.querySelector('[data-admin-publicidades]');
const statusBox = document.querySelector('#firebase-status');

function setStatus(message, kind = 'info') {
  if (!statusBox) return;
  statusBox.textContent = message;
  statusBox.dataset.kind = kind;
  statusBox.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '#';
  } catch (_) {
    return '#';
  }
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
  if (!publicSlot || !ad) return;
  const href = safeUrl(ad.enlace || '');
  publicSlot.innerHTML = `
    <a class="ad-live" href="${href}" ${href === '#' ? '' : 'target="_blank" rel="noopener"'}>
      ${ad.imagenUrl ? `<img src="${ad.imagenUrl}" alt="Publicidad: ${ad.titulo || 'Radio Tiempo Muerto'}">` : ''}
      <span class="ad-live-copy"><strong>${ad.titulo || 'Publicidad'}</strong><small>${ad.descripcion || 'Conocé esta propuesta.'}</small></span>
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

    // Portada: lectura pública de publicidades activas.
    if (publicSlot) {
      try {
        const publicQuery = firestoreModule.query(
          firestoreModule.collection(db, 'publicidades'),
          firestoreModule.where('activa', '==', true)
        );
        const snapshot = await firestoreModule.getDocs(publicQuery);
        const ads = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(ad => !ad.ubicacion || ad.ubicacion === 'portada')
          .sort((a, b) => Number(a.orden || 99) - Number(b.orden || 99));
        if (ads[0]) renderPublicAd(ads[0]);
      } catch (error) {
        console.error('Error leyendo publicidades públicas:', error);
      }
    }

    if (!adminRoot) return;

    const auth = authModule.getAuth(app);
    const loginButton = document.querySelector('#firebase-login');
    const logoutButton = document.querySelector('#firebase-logout');
    const userLabel = document.querySelector('#firebase-user');
    const form = document.querySelector('#publicidad-form');
    const list = document.querySelector('#publicidades-list');

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
          item.innerHTML = `
            ${ad.imagenUrl ? `<img src="${ad.imagenUrl}" alt="${ad.titulo || 'Publicidad'}">` : '<div class="ad-admin-noimage">Sin imagen</div>'}
            <div><strong>${ad.titulo || 'Publicidad sin título'}</strong><small>${ad.ubicacion || 'portada'} · orden ${ad.orden || 1}</small><span>${ad.activa === false ? 'Inactiva' : 'Activa'}</span></div>
            <div class="ad-admin-actions"><button type="button" class="btn btn-light" data-ad-toggle>${ad.activa === false ? 'Activar' : 'Desactivar'}</button><button type="button" class="btn btn-danger" data-ad-delete>Eliminar</button></div>`;

          item.querySelector('[data-ad-toggle]').addEventListener('click', async () => {
            try {
              await firestoreModule.updateDoc(firestoreModule.doc(db, 'publicidades', ad.id), { activa: ad.activa === false });
              setStatus('Estado de la publicidad actualizado.', 'success');
              await loadAds();
            } catch (error) {
              setStatus(firebaseErrorText(error, 'Firestore'), 'error');
            }
          });

          item.querySelector('[data-ad-delete]').addEventListener('click', async () => {
            if (!confirm('¿Eliminar esta publicidad?')) return;
            try {
              await firestoreModule.deleteDoc(firestoreModule.doc(db, 'publicidades', ad.id));
              setStatus('Publicidad eliminada.', 'success');
              await loadAds();
            } catch (error) {
              setStatus(firebaseErrorText(error, 'Firestore'), 'error');
            }
          });
          list.appendChild(item);
        });
      } catch (error) {
        console.error('Error leyendo publicidades:', error);
        list.innerHTML = '<p class="muted">No se pudieron leer las publicidades.</p>';
        setStatus(firebaseErrorText(error, 'Firestore'), 'error');
      }
    }

    loginButton?.addEventListener('click', async () => {
      const provider = new authModule.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try {
        await authModule.signInWithPopup(auth, provider);
      } catch (error) {
        console.error(error);
        setStatus(firebaseErrorText(error, 'Authentication'), 'error');
      }
    });

    logoutButton?.addEventListener('click', async () => {
      await authModule.signOut(auth);
      setStatus('Sesión cerrada.', 'info');
    });

    authModule.onAuthStateChanged(auth, async user => {
      const allowed = Boolean(user && user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase());
      if (user && !allowed) {
        setStatus(`La cuenta ${user.email} no está autorizada para administrar publicidades.`, 'error');
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

      if (allowed) {
        setStatus('Firebase conectado. Comprobando permisos de Firestore…', 'success');
        await loadAds();
      } else {
        if (list) list.innerHTML = '<p class="muted">Iniciá sesión para ver las publicidades.</p>';
        setStatus('Iniciá sesión con la cuenta administradora para modificar publicidades.', 'info');
      }
    });

    form?.addEventListener('submit', async event => {
      event.preventDefault();
      const user = auth.currentUser;
      if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        setStatus('Primero iniciá sesión con la cuenta administradora.', 'error');
        return;
      }

      const submitButton = form.querySelector('button[type="submit"]');
      const data = new FormData(form);
      const file = data.get('imagen');
      let imagenUrl = String(data.get('imagenUrl') || '').trim();
      let imageWarning = '';

      try {
        if (submitButton) submitButton.disabled = true;
        setStatus('Guardando publicidad…', 'info');

        // La publicidad se puede guardar aunque Cloud Storage todavía no esté habilitado.
        if (file && file.size) {
          try {
            setStatus('Subiendo imagen…', 'info');
            const storageModule = await import('https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js');
            const storage = storageModule.getStorage(app);
            const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
            const fileRef = storageModule.ref(storage, `publicidades/${Date.now()}-${cleanName}`);
            await storageModule.uploadBytes(fileRef, file, { contentType: file.type });
            imagenUrl = await storageModule.getDownloadURL(fileRef);
          } catch (error) {
            console.error('No se pudo subir la imagen:', error);
            imageWarning = firebaseErrorText(error, 'Storage');
          }
        }

        setStatus('Guardando datos en Firestore…', 'info');
        await firestoreModule.addDoc(firestoreModule.collection(db, 'publicidades'), {
          titulo: String(data.get('titulo') || '').trim(),
          descripcion: String(data.get('descripcion') || '').trim(),
          enlace: String(data.get('enlace') || '').trim(),
          ubicacion: String(data.get('ubicacion') || 'portada'),
          orden: Number(data.get('orden') || 1),
          activa: data.get('activa') === 'on',
          imagenUrl,
          creadaEn: firestoreModule.serverTimestamp(),
          creadaPor: user.email
        });

        form.reset();
        const activeCheckbox = form.querySelector('[name="activa"]');
        if (activeCheckbox) activeCheckbox.checked = true;
        const orderInput = form.querySelector('[name="orden"]');
        if (orderInput) orderInput.value = '1';

        if (imageWarning && !imagenUrl) {
          setStatus(`Publicidad guardada SIN imagen. ${imageWarning}`, 'warning');
        } else {
          setStatus('Publicidad guardada correctamente.', 'success');
        }
        await loadAds();
      } catch (error) {
        console.error('No se pudo guardar la publicidad:', error);
        setStatus(firebaseErrorText(error, 'Firestore'), 'error');
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  } catch (error) {
    console.error(error);
    setStatus(firebaseErrorText(error, 'Firebase'), 'error');
  }
}

initFirebase();
