import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore, collection, query, where, orderBy, onSnapshot,
  doc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const acceso = document.querySelector("#acceso");
const panel = document.querySelector("#panel");
const pedidos = document.querySelector("#pedidos");
let cancelarEscucha = null;

document.querySelector("#ingresar").addEventListener("click", () => signInWithPopup(auth, provider));
document.querySelector("#salir").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (usuario) => {
  if (cancelarEscucha) cancelarEscucha();

  if (!usuario) {
    acceso.classList.remove("oculto");
    panel.classList.add("oculto");
    return;
  }

  acceso.classList.add("oculto");
  panel.classList.remove("oculto");

  const q = query(
    collection(db, "pedidosCanciones"),
    where("estado", "==", "pendiente"),
    orderBy("creadoEn", "asc")
  );

  cancelarEscucha = onSnapshot(q, (snap) => {
    pedidos.innerHTML = "";
    if (snap.empty) {
      pedidos.innerHTML = '<div class="estado">No hay pedidos pendientes.</div>';
      return;
    }

    snap.forEach((documento) => {
      const p = documento.data();
      const item = document.createElement("article");
      item.className = "pedido";
      item.innerHTML = `
        <strong>${escapar(p.artista)} — ${escapar(p.titulo)}</strong>
        <div class="detalle">Pidió: ${escapar(p.nombre)} · ${escapar(p.ciudad)}</div>
        <p>${escapar(p.mensaje || "Sin mensaje")}</p>
        <span class="chip">Pendiente</span>
        <div class="acciones">
          <button class="ok aprobar">Aprobar</button>
          <button class="secundario rechazar">Rechazar</button>
        </div>
      `;
      item.querySelector(".aprobar").addEventListener("click", () =>
        cambiarEstado(documento.id, "aprobado")
      );
      item.querySelector(".rechazar").addEventListener("click", () =>
        cambiarEstado(documento.id, "rechazado")
      );
      pedidos.appendChild(item);
    });
  });
});

async function cambiarEstado(id, estado) {
  await updateDoc(doc(db, "pedidosCanciones", id), {
    estado,
    revisadoEn: serverTimestamp(),
    revisadoPor: auth.currentUser?.email || ""
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
