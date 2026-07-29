const fs = require("fs");
const http = require("http");
const admin = require("firebase-admin");

function leerJson(nombre) {
  if (!fs.existsSync(nombre)) throw new Error(`Falta ${nombre}`);
  return JSON.parse(fs.readFileSync(nombre, "utf8"));
}

const config = leerJson("./config.json");
const credencial = leerJson(`./${config.firebase.serviceAccount}`);

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(credencial) });
}
const db = admin.firestore();

function pedirPlaybackInfo() {
  return new Promise((resolve, reject) => {
    const qs = new URLSearchParams({
      pass: config.radioBoss.contrasena,
      action: "playbackinfo"
    });

    const req = http.request({
      hostname: config.radioBoss.host || "127.0.0.1",
      port: config.radioBoss.puerto || 9000,
      path: `/?${qs.toString()}`,
      method: "GET",
      timeout: 7000
    }, res => {
      let cuerpo = "";
      res.setEncoding("utf8");
      res.on("data", x => cuerpo += x);
      res.on("end", () => resolve(cuerpo.trim()));
    });

    req.on("timeout", () => req.destroy(new Error("RadioBOSS no respondió")));
    req.on("error", reject);
    req.end();
  });
}

function valor(xml, nombres) {
  for (const nombre of nombres) {
    const re = new RegExp(`<${nombre}[^>]*>([\\s\\S]*?)<\\/${nombre}>`, "i");
    const m = xml.match(re);
    if (m) return limpiar(m[1]);
  }
  return "";
}

function atributo(xml, nombres) {
  for (const nombre of nombres) {
    const re = new RegExp(`${nombre}=["']([^"']*)["']`, "i");
    const m = xml.match(re);
    if (m) return limpiar(m[1]);
  }
  return "";
}

function limpiar(texto) {
  return String(texto || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function numero(valor) {
  const n = Number(String(valor || "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function separarArtistaTitulo(texto) {
  const partes = String(texto || "").split(/\s+-\s+/);
  if (partes.length >= 2) {
    return { artista: partes.shift().trim(), titulo: partes.join(" - ").trim() };
  }
  return { artista: "", titulo: texto || "" };
}

function interpretar(xml) {
  const textoCompleto =
    valor(xml, ["track", "title", "streamtitle", "song", "nowplaying"]) ||
    atributo(xml, ["track", "title", "streamtitle", "song"]);

  const separados = separarArtistaTitulo(textoCompleto);

  const artista =
    valor(xml, ["artist", "performer"]) ||
    atributo(xml, ["artist", "performer"]) ||
    separados.artista;

  const titulo =
    valor(xml, ["title", "tracktitle", "songtitle"]) ||
    atributo(xml, ["title", "tracktitle", "songtitle"]) ||
    separados.titulo;

  const duracionSegundos = numero(
    valor(xml, ["duration", "length", "totaltime"]) ||
    atributo(xml, ["duration", "length", "totaltime"])
  );

  const posicionSegundos = numero(
    valor(xml, ["position", "elapsed", "playbackposition", "currenttime"]) ||
    atributo(xml, ["position", "elapsed", "playbackposition", "currenttime"])
  );

  const proximo =
    valor(xml, ["nexttrack", "next", "upnext"]) ||
    atributo(xml, ["nexttrack", "next", "upnext"]);

  return {
    artista: artista || "Radio Tiempo Muerto",
    titulo: titulo || textoCompleto || "Programación en vivo",
    duracionSegundos,
    posicionSegundos,
    proximo,
    enVivo: true,
    actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
    fuente: "RadioBOSS 6.0.3.1"
  };
}

async function actualizar() {
  try {
    const respuesta = await pedirPlaybackInfo();

    if (!respuesta || /^E\d+:/i.test(respuesta)) {
      throw new Error(respuesta || "RadioBOSS devolvió una respuesta vacía");
    }

    const datos = interpretar(respuesta);
    await db.collection("estadoRadio").doc("ahora").set(datos, { merge: true });

    console.log(`✔ ${datos.artista} - ${datos.titulo}`);
  } catch (error) {
    console.error("✘ Metadata:", error.message);
    await db.collection("estadoRadio").doc("ahora").set({
      enVivo: false,
      error: error.message,
      actualizadoEn: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }
}

const intervalo = Math.max(2, Number(config.metadata?.intervaloSegundos || 5)) * 1000;
console.log("Metadata de RadioBOSS iniciada.");
actualizar();
setInterval(actualizar, intervalo);
