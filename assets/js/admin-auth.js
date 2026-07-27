import { FIREBASE_ENABLED, ADMIN_EMAIL, firebaseConfig } from './firebase-config.js?v=admin3';

const roots = document.querySelectorAll('[data-admin-auth]');
if (roots.length) initAdminAuth();

function setStatus(message, kind = 'info') {
  document.querySelectorAll('#admin-auth-status').forEach(box => {
    box.textContent = message;
    box.dataset.kind = kind;
  });
}

function setProtected(allowed) {
  document.querySelectorAll('[data-admin-protected]').forEach(section => {
    section.hidden = !allowed;
  });
}

async function initAdminAuth() {
  if (!FIREBASE_ENABLED || !firebaseConfig.apiKey || !firebaseConfig.projectId) {
    setStatus('Firebase no está configurado en esta versión de la página.', 'error');
    setProtected(false);
    return;
  }

  try {
    const [{ initializeApp }, authModule] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js')
    ]);

    const app = initializeApp(firebaseConfig);
    const auth = authModule.getAuth(app);
    const loginButtons = document.querySelectorAll('#admin-auth-login');
    const logoutButtons = document.querySelectorAll('#admin-auth-logout');
    const userLabels = document.querySelectorAll('#admin-auth-user');

    loginButtons.forEach(button => button.addEventListener('click', async () => {
      const provider = new authModule.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try {
        setStatus('Abriendo el ingreso con Google…', 'info');
        await authModule.signInWithPopup(auth, provider);
      } catch (error) {
        console.error(error);
        const message = error?.code === 'auth/unauthorized-domain'
          ? 'Este dominio todavía no está autorizado en Firebase Authentication.'
          : 'No se pudo iniciar sesión con Google. Revisá que Google esté activado en Authentication.';
        setStatus(message, 'error');
      }
    }));

    logoutButtons.forEach(button => button.addEventListener('click', () => authModule.signOut(auth)));

    authModule.onAuthStateChanged(auth, async user => {
      const email = user?.email?.toLowerCase() || '';
      const allowed = Boolean(user && email === ADMIN_EMAIL.toLowerCase());

      if (user && !allowed) {
        setStatus(`La cuenta ${user.email} no está autorizada. Ingresá con ${ADMIN_EMAIL}.`, 'error');
        await authModule.signOut(auth);
        return;
      }

      userLabels.forEach(label => {
        label.textContent = allowed ? `Conectado como ${user.email}` : 'No has iniciado sesión';
      });
      loginButtons.forEach(button => { button.hidden = allowed; });
      logoutButtons.forEach(button => { button.hidden = !allowed; });
      setProtected(allowed);
      setStatus(
        allowed ? 'Acceso autorizado. Ya podés usar el panel administrador.' : `Ingresá con ${ADMIN_EMAIL} para administrar la página.`,
        allowed ? 'success' : 'info'
      );

      window.RadioTMAdmin = { app, auth, user, allowed };
      window.dispatchEvent(new CustomEvent('radiotm-admin-auth', { detail: window.RadioTMAdmin }));
    });
  } catch (error) {
    console.error(error);
    setStatus('No se pudo conectar con Firebase. Revisá internet y volvé a cargar la página.', 'error');
    setProtected(false);
  }
}
