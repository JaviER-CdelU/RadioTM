import { FIREBASE_ENABLED, ADMIN_EMAIL, firebaseConfig } from './firebase-config.js';

const publicSlot = document.querySelector('#publicidad-portada');
const adminRoot = document.querySelector('[data-admin-publicidades]');
const statusBox = document.querySelector('#firebase-status');

function setStatus(message, kind = 'info') {
  if (!statusBox) return;
  statusBox.textContent = message;
  statusBox.dataset.kind = kind;
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '#';
  } catch (_) {
    return '#';
  }
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
      setStatus('Firebase está preparado, pero todavía no está conectado. Completá assets/js/firebase-config.js y activalo.', 'warning');
      adminRoot.querySelectorAll('input, select, textarea, button[type="submit"]').forEach(el => el.disabled = true);
    }
    return;
  }

  try {
    const [{ initializeApp }, firestoreModule, authModule, storageModule] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js'),
      import('https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js')
    ]);

    const app = initializeApp(firebaseConfig);
    const db = firestoreModule.getFirestore(app);

    // Portada: lectura pública de publicidades activas.
    if (publicSlot) {
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
    }

    if (!adminRoot) return;

    const auth = authModule.getAuth(app);
    const storage = storageModule.getStorage(app);
    const loginButton = document.querySelector('#firebase-login');
    const logoutButton = document.querySelector('#firebase-logout');
    const userLabel = document.querySelector('#firebase-user');
    const form = document.querySelector('#publicidad-form');
    const list = document.querySelector('#publicidades-list');

    async function loadAds() {
      const snapshot = await firestoreModule.getDocs(firestoreModule.collection(db, 'publicidades'));
      const ads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => Number(a.orden || 99) - Number(b.orden || 99));
      if (!list) return;
      list.innerHTML = ads.length ? '' : '<p class="muted">Todavía no hay publicidades guardadas.</p>';
      ads.forEach(ad => {
        const item = document.createElement('article');
        item.className = 'ad-admin-item';
        item.innerHTML = `
          ${ad.imagenUrl ? `<img src="${ad.imagenUrl}" alt="${ad.titulo || 'Publicidad'}">` : '<div class="ad-admin-noimage">Sin imagen</div>'}
          <div><strong>${ad.titulo || 'Publicidad sin título'}</strong><small>${ad.ubicacion || 'portada'} · orden ${ad.orden || 1}</small><span>${ad.activa === false ? 'Inactiva' : 'Activa'}</span></div>
          <div class="ad-admin-actions"><button type="button" class="btn btn-light" data-ad-toggle>${ad.activa === false ? 'Activar' : 'Desactivar'}</button><button type="button" class="btn btn-danger" data-ad-delete>Eliminar</button></div>`;
        item.querySelector('[data-ad-toggle]').addEventListener('click', async () => {
          await firestoreModule.updateDoc(firestoreModule.doc(db, 'publicidades', ad.id), { activa: ad.activa === false });
          await loadAds();
        });
        item.querySelector('[data-ad-delete]').addEventListener('click', async () => {
          if (!confirm('¿Eliminar esta publicidad?')) return;
          await firestoreModule.deleteDoc(firestoreModule.doc(db, 'publicidades', ad.id));
          await loadAds();
        });
        list.appendChild(item);
      });
    }

    loginButton?.addEventListener('click', async () => {
      const provider = new authModule.GoogleAuthProvider();
      try {
        await authModule.signInWithPopup(auth, provider);
      } catch (error) {
        setStatus('No se pudo iniciar sesión con Google.', 'error');
      }
    });
    logoutButton?.addEventListener('click', () => authModule.signOut(auth));

    authModule.onAuthStateChanged(auth, async user => {
      const allowed = user && user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
      if (user && !allowed) {
        setStatus(`La cuenta ${user.email} no está autorizada para administrar publicidades.`, 'error');
        await authModule.signOut(auth);
        return;
      }
      if (userLabel) userLabel.textContent = allowed ? `Conectado: ${user.email}` : 'No has iniciado sesión';
      if (loginButton) loginButton.hidden = Boolean(allowed);
      if (logoutButton) logoutButton.hidden = !allowed;
      adminRoot.querySelectorAll('input, select, textarea, button[type="submit"]').forEach(el => el.disabled = !allowed);
      setStatus(allowed ? 'Firebase conectado. Ya podés cargar y administrar publicidades.' : 'Iniciá sesión con la cuenta administradora para modificar publicidades.', allowed ? 'success' : 'info');
      if (allowed) await loadAds();
    });

    form?.addEventListener('submit', async event => {
      event.preventDefault();
      const user = auth.currentUser;
      if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return;
      const data = new FormData(form);
      const file = data.get('imagen');
      let imagenUrl = '';
      try {
        setStatus('Guardando publicidad…', 'info');
        if (file && file.size) {
          const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
          const fileRef = storageModule.ref(storage, `publicidades/${Date.now()}-${cleanName}`);
          await storageModule.uploadBytes(fileRef, file, { contentType: file.type });
          imagenUrl = await storageModule.getDownloadURL(fileRef);
        }
        await firestoreModule.addDoc(firestoreModule.collection(db, 'publicidades'), {
          titulo: String(data.get('titulo') || '').trim(),
          descripcion: String(data.get('descripcion') || '').trim(),
          enlace: String(data.get('enlace') || '').trim(),
          ubicacion: String(data.get('ubicacion') || 'portada'),
          orden: Number(data.get('orden') || 1),
          activa: data.get('activa') === 'on',
          imagenUrl,
          creadaEn: firestoreModule.serverTimestamp()
        });
        form.reset();
        setStatus('Publicidad guardada correctamente.', 'success');
        await loadAds();
      } catch (error) {
        console.error(error);
        setStatus('No se pudo guardar. Revisá la configuración y las reglas de Firebase.', 'error');
      }
    });
  } catch (error) {
    console.error(error);
    setStatus('No se pudo conectar con Firebase. Revisá la configuración y la conexión a internet.', 'error');
  }
}

initFirebase();
