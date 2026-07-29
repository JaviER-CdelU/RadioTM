(() => {
  const FIREBASE_APP = "https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js";
  const FIRESTORE = "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js";

  const firebaseConfig = {
    apiKey: "AIzaSyC58rAZNDk0IwsP_17Zyuat_RNirVy88So",
    authDomain: "radio-tiempo-muerto-662a1.firebaseapp.com",
    projectId: "radio-tiempo-muerto-662a1",
    storageBucket: "radio-tiempo-muerto-662a1.firebasestorage.app",
    messagingSenderId: "549240345202",
    appId: "1:549240345202:web:c167372af76b1e4c9528eb",
    measurementId: "G-TL899D9QJJ"
  };

  function cargarScript(src) {
    return new Promise((resolve, reject) => {
      const existente = [...document.scripts].find(script => script.src === src);
      if (existente) {
        if (src.includes("firebase-app") && window.firebase) return resolve();
        if (src.includes("firebase-firestore") && window.firebase?.firestore) return resolve();
        existente.addEventListener("load", resolve, { once: true });
        existente.addEventListener("error", reject, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function escapar(valor = "") {
    return String(valor)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function instalarEstilos() {
    if (document.getElementById("rtm-popup-pedido-estilos")) return;

    const style = document.createElement("style");
    style.id = "rtm-popup-pedido-estilos";
    style.textContent = `
      #rtm-popup-pedido {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 99999;
        width: min(430px, calc(100vw - 28px));
        padding: 17px 46px 17px 18px;
        border: 1px solid rgba(255,255,255,.18);
        border-left: 6px solid #ff6416;
        border-radius: 17px;
        background: rgba(24, 26, 31, .97);
        color: #fff;
        box-shadow: 0 22px 65px rgba(0,0,0,.42);
        font-family: Arial, Helvetica, sans-serif;
        transform: translateY(30px);
        opacity: 0;
        pointer-events: none;
        transition: opacity .35s ease, transform .35s ease;
        backdrop-filter: blur(12px);
      }

      #rtm-popup-pedido.rtm-visible {
        transform: translateY(0);
        opacity: 1;
        pointer-events: auto;
      }

      #rtm-popup-pedido .rtm-etiqueta {
        display: block;
        margin-bottom: 7px;
        color: #ff8d58;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: .08em;
        text-transform: uppercase;
      }

      #rtm-popup-pedido .rtm-tema {
        margin: 0;
        font-size: 21px;
        line-height: 1.15;
        font-weight: 900;
      }

      #rtm-popup-pedido .rtm-persona {
        margin-top: 8px;
        color: #d7dbe2;
        font-size: 14px;
        line-height: 1.4;
      }

      #rtm-popup-pedido .rtm-saludo {
        margin-top: 9px;
        padding: 9px 11px;
        border-radius: 10px;
        background: rgba(255,255,255,.07);
        color: #fff;
        font-size: 14px;
        line-height: 1.4;
        font-style: italic;
      }

      #rtm-popup-pedido .rtm-cerrar {
        position: absolute;
        top: 10px;
        right: 11px;
        width: 30px;
        height: 30px;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: rgba(255,255,255,.1);
        color: #fff;
        font-size: 20px;
        line-height: 30px;
        cursor: pointer;
      }

      @media (max-width: 600px) {
        #rtm-popup-pedido {
          right: 14px;
          bottom: 14px;
          width: calc(100vw - 28px);
        }
      }
    `;
    document.head.appendChild(style);
  }

  function crearPopup() {
    let popup = document.getElementById("rtm-popup-pedido");
    if (popup) return popup;

    popup = document.createElement("aside");
    popup.id = "rtm-popup-pedido";
    popup.setAttribute("role", "status");
    popup.setAttribute("aria-live", "polite");
    document.body.appendChild(popup);
    return popup;
  }

  let temporizador = null;

  function mostrarPopup(datos) {
    const popup = crearPopup();
    const id = datos.id || "";
    const nombre = datos.nombre || "Un oyente";
    const ciudad = datos.ciudad || "";
    const artista = datos.artista || "Artista desconocido";
    const titulo = datos.titulo || "Canción solicitada";
    const mensaje = datos.mensaje || "";

    popup.innerHTML = `
      <button class="rtm-cerrar" type="button" aria-label="Cerrar">×</button>
      <span class="rtm-etiqueta">🎵 Música pedida por nuestros oyentes</span>
      <h3 class="rtm-tema">${escapar(artista)} — ${escapar(titulo)}</h3>
      <div class="rtm-persona">
        Pedido por <strong>${escapar(nombre)}</strong>${ciudad ? `, desde <strong>${escapar(ciudad)}</strong>` : ""}
      </div>
      ${mensaje ? `<div class="rtm-saludo">“${escapar(mensaje)}”</div>` : ""}
    `;

    popup.querySelector(".rtm-cerrar").addEventListener("click", () => {
      popup.classList.remove("rtm-visible");
    });

    requestAnimationFrame(() => popup.classList.add("rtm-visible"));

    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      popup.classList.remove("rtm-visible");
    }, 15000);

    if (id) localStorage.setItem("rtmUltimoPopupPedido", id);
  }

  async function iniciar() {
    try {
      instalarEstilos();
      await cargarScript(FIREBASE_APP);
      await cargarScript(FIRESTORE);

      const app = firebase.apps.length
        ? firebase.app()
        : firebase.initializeApp(firebaseConfig);

      const db = app.firestore();

      db.collection("estadoRadio")
        .doc("pedidoActual")
        .onSnapshot(documento => {
          if (!documento.exists) return;

          const datos = documento.data() || {};
          const id = datos.id || documento.id;
          const ultimoVisto = localStorage.getItem("rtmUltimoPopupPedido");

          if (!id || id === ultimoVisto) return;

          const publicado = datos.publicadoEn?.toMillis?.() || 0;
          const antiguedad = Date.now() - publicado;

          // Evita mostrar pedidos viejos al abrir la página mucho después.
          if (publicado && antiguedad > 10 * 60 * 1000) {
            localStorage.setItem("rtmUltimoPopupPedido", id);
            return;
          }

          mostrarPopup({ ...datos, id });
        }, error => {
          console.error("Popup de pedidos:", error);
        });
    } catch (error) {
      console.error("No se pudo iniciar el popup de pedidos:", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();
