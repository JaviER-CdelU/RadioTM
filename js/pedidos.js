import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore, collection, query, where, orderBy, limit, getDocs,
  addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const busqueda = document.querySelector("#busqueda");
const resultados = document.querySelector("#resultados");
const formularioPanel = document.querySelector("#formularioPanel");
const cancionElegida = document.querySelector("#cancionElegida");
const formPedido = document.querySelector("#formPedido");
const cancelar = document.querySelector("#cancelar");
const estado = document.querySelector("#estado");

let seleccion = null;
let temporizador = null;

const normalizar = (texto = "") =>
  texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

function mostrarEstado(texto, esError = false) {
  estado.textContent = texto;
  estado.classList.remove("oculto");
  estado.style.border = esError ? "1px solid #ef5350" : "1px solid #4caf50";
}

async function buscarCanciones() {
  const termino = normalizar(busqueda.value);
  resultados.innerHTML = "";

  if (termino.length < 2) return;

  try {
    const q = query(
      collection(db, "canciones"),
      where("busquedaTokens", "array-contains", termino),
      orderBy("titulo"),
      limit(30)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      resultados.innerHTML = '<div class="estado">No encontramos canciones con esa búsqueda.</div>';
      return;
    }

    snap.forEach((documento) => {
      const c = documento.data();
      const item = document.createElement("article");
      item.className = "cancion";
      item.innerHTML = `
        <div>
          <strong>${escapar(c.artista || "Artista desconocido")} — ${escapar(c.titulo || "Sin título")}</strong>
          <div class="detalle">${escapar(c.album || "")}</div>
        </div>
        <button type="button">Pedir</button>
      `;
      item.querySelector("button").addEventListener("click", () => {
        seleccion = { id: documento.id, ...c };
        cancionElegida.textContent = `${c.artista || "Artista desconocido"} — ${c.titulo || "Sin título"}`;
        formularioPanel.classList.remove("oculto");
        formularioPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      resultados.appendChild(item);
    });
  } catch (error) {
    console.error(error);
    resultados.innerHTML = '<div class="estado">No se pudo buscar. Revisá la configuración de Firebase y los índices.</div>';
  }
}

busqueda.addEventListener("input", () => {
  clearTimeout(temporizador);
  temporizador = setTimeout(buscarCanciones, 350);
});

cancelar.addEventListener("click", () => {
  seleccion = null;
  formPedido.reset();
  formularioPanel.classList.add("oculto");
  estado.classList.add("oculto");
  busqueda.focus();
});

formPedido.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  if (!seleccion) return;

  const nombre = document.querySelector("#nombre").value.trim();
  const ciudad = document.querySelector("#ciudad").value.trim();
  const mensaje = document.querySelector("#mensaje").value.trim();

  try {
    mostrarEstado("Enviando pedido…");
    await addDoc(collection(db, "pedidosCanciones"), {
      cancionId: seleccion.id,
      artista: seleccion.artista || "",
      titulo: seleccion.titulo || "",
      archivo: seleccion.archivo,
      nombre,
      ciudad,
      mensaje,
      estado: "pendiente",
      creadoEn: serverTimestamp(),
      origen: "web"
    });
    formPedido.reset();
    mostrarEstado("¡Pedido recibido! Quedó esperando la aprobación del operador.");
  } catch (error) {
    console.error(error);
    mostrarEstado("No se pudo enviar el pedido. Probá nuevamente.", true);
  }
});

function escapar(valor) {
  return String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
