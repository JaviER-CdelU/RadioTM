const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const mm = require("music-metadata");

function cargarJson(nombre) {
  if (!fs.existsSync(nombre)) throw new Error(`Falta ${nombre}`);
  return JSON.parse(fs.readFileSync(nombre, "utf8"));
}

const config = cargarJson("./config.json");
const credencial = cargarJson(`./${config.firebase.serviceAccount}`);

admin.initializeApp({ credential: admin.credential.cert(credencial) });
const db = admin.firestore();

const extensiones = new Set((config.musica.extensiones || [".mp3"]).map(x => x.toLowerCase()));

function recorrer(carpeta, salida = []) {
  if (!fs.existsSync(carpeta)) {
    console.warn(`No existe: ${carpeta}`);
    return salida;
  }
  for (const entrada of fs.readdirSync(carpeta, { withFileTypes: true })) {
    const completa = path.join(carpeta, entrada.name);
    if (entrada.isDirectory()) recorrer(completa, salida);
    else if (extensiones.has(path.extname(entrada.name).toLowerCase())) salida.push(completa);
  }
  return salida;
}

function limpiarNombre(nombre) {
  return nombre
    .replace(path.extname(nombre), "")
    .replace(/^\\d+[\\s._-]+/, "")
    .replaceAll("_", " ")
    .trim();
}

function tokens(texto) {
  const limpio = String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .replace(/[^a-z0-9\\s]/g, " ")
    .replace(/\\s+/g, " ")
    .trim();

  const resultado = new Set();
  for (const palabra of limpio.split(" ")) {
    for (let i = 2; i <= palabra.length; i++) resultado.add(palabra.slice(0, i));
  }
  return [...resultado].slice(0, 250);
}

async function obtenerDatos(archivo) {
  let artista = "";
  let titulo = "";
  let album = "";
  let duracionSegundos = 0;

  try {
    const datos = await mm.parseFile(archivo, { duration: true });
    artista = datos.common.artist || "";
    titulo = datos.common.title || "";
    album = datos.common.album || "";
    duracionSegundos = Math.round(datos.format.duration || 0);
  } catch (_) {}

  titulo ||= limpiarNombre(path.basename(archivo));
  artista ||= path.basename(path.dirname(archivo));

  const minutos = Math.floor(duracionSegundos / 60);
  const segundos = String(duracionSegundos % 60).padStart(2, "0");

  return {
    archivo,
    artista,
    titulo,
    album,
    duracionSegundos,
    duracionTexto: duracionSegundos ? `${minutos}:${segundos}` : "",
    activo: true,
    busquedaTokens: tokens(`${artista} ${titulo} ${album}`),
    actualizadoEn: admin.firestore.FieldValue.serverTimestamp()
  };
}

async function subirEnLotes(canciones) {
  let lote = db.batch();
  let cantidad = 0;

  for (const cancion of canciones) {
    const id = Buffer.from(cancion.archivo.toLowerCase()).toString("base64url").slice(0, 1400);
    lote.set(db.collection("canciones").doc(id), cancion, { merge: true });
    cantidad++;

    if (cantidad % 400 === 0) {
      await lote.commit();
      lote = db.batch();
      console.log(`Subidas ${cantidad} canciones…`);
    }
  }
  if (cantidad % 400 !== 0) await lote.commit();
  return cantidad;
}

(async () => {
  const archivos = [];
  for (const carpeta of config.musica.carpetas) recorrer(carpeta, archivos);

  console.log(`Encontrados ${archivos.length} archivos.`);
  const canciones = [];
  let procesadas = 0;

  for (const archivo of archivos) {
    canciones.push(await obtenerDatos(archivo));
    procesadas++;
    if (procesadas % 100 === 0) console.log(`Leídas ${procesadas}/${archivos.length}`);
  }

  const total = await subirEnLotes(canciones);
  console.log(`✔ Catálogo terminado: ${total} canciones.`);
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
