import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

const artista = document.querySelector("[data-radio-artista]");
const titulo = document.querySelector("[data-radio-titulo]");
const duracion = document.querySelector("[data-radio-duracion]");
const progreso = document.querySelector("[data-radio-progreso]");
const tiempoActual = document.querySelector("[data-radio-tiempo-actual]");
const proximo = document.querySelector("[data-radio-proximo]");
const estado = document.querySelector("[data-radio-metadata-estado]");

const formatoTiempo = (segundos) => {
  const s = Math.max(0, Number(segundos || 0));
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

onSnapshot(doc(db, "estadoRadio", "ahora"), (snap) => {
  if (!snap.exists()) {
    if (estado) estado.textContent = "ESPERANDO DATOS";
    return;
  }

  const d = snap.data();
  if (artista) artista.textContent = d.artista || "Radio Tiempo Muerto";
  if (titulo) titulo.textContent = d.titulo || "Programación en vivo";
  if (duracion) duracion.textContent = formatoTiempo(d.duracionSegundos);
  if (tiempoActual) tiempoActual.textContent = formatoTiempo(d.posicionSegundos);
  if (proximo) proximo.textContent = d.proximo || "A confirmar";

  const porcentaje = d.duracionSegundos > 0
    ? Math.min(100, Math.max(0, (d.posicionSegundos / d.duracionSegundos) * 100))
    : 0;

  if (progreso) progreso.style.width = `${porcentaje}%`;
  if (estado) estado.textContent = d.enVivo ? "EN VIVO" : "FUERA DE LÍNEA";
});
