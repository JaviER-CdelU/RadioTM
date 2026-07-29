const fs = require("fs");
const http = require("http");
const admin = require("firebase-admin");

function cargarJson(nombre) {
  if (!fs.existsSync(nombre)) throw new Error(`Falta ${nombre}`);
  return JSON.parse(fs.readFileSync(nombre, "utf8"));
}

const config = cargarJson("./config.json");
const credencial = cargarJson(`./${config.firebase.serviceAccount}`);

admin.initializeApp({
  credential: admin.credential.cert(credencial)
});

const db = admin.firestore();
let ocupado = false;
const enviadosEnEstaSesion = new Set();

function conTiempoLimite(promesa, milisegundos, mensaje) {
  return Promise.race([
    promesa,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(mensaje)), milisegundos)
    )
  ]);
}

function enviarARadioBoss(archivo, mensaje) {
  return new Promise((resolve, reject) => {
    const parametros = new URLSearchParams({
      pass: String(config.radioBoss.contrasena),
      action: "songrequest",
      filename: archivo,
      message: mensaje
    });

    const solicitud = http.request({
      hostname: config.radioBoss.host || "127.0.0.1",
      port: Number(config.radioBoss.puerto || 9000),
      path: `/?${parametros.toString()}`,
      method: "GET",
      timeout: 15000,
      agent: false,
      headers: { "Connection": "close" }
    }, respuesta => {
      let cuerpo = "";
      respuesta.setEncoding("utf8");
      respuesta.on("data", parte => cuerpo += parte);
      respuesta.on("end", () => {
        const texto = cuerpo.trim();
        if (texto === "OK") resolve();
        else reject(new Error(`RadioBOSS respondió: ${texto || "sin respuesta"}`));
      });
    });

    solicitud.on("timeout", () => {
      solicitud.destroy(new Error("RadioBOSS demoró demasiado"));
    });

    solicitud.on("error", reject);
    solicitud.end();
  });
}

async function publicarPopup(documento, pedido) {
  const datosPublicos = {
    id: documento.id,
    artista: pedido.artista || "Artista desconocido",
    titulo: pedido.titulo || "Canción solicitada",
    nombre: pedido.nombre || "Un oyente",
    ciudad: pedido.ciudad || "",
    mensaje: pedido.mensaje || "",
    publicadoEn: admin.firestore.FieldValue.serverTimestamp()
  };

  await conTiempoLimite(
    db.collection("estadoRadio").doc("pedidoActual").set(datosPublicos),
    15000,
    "Firebase demoró al publicar el popup"
  );
}

async function procesarPedidos() {
  if (ocupado) return;
  ocupado = true;

  try {
    const todos = await conTiempoLimite(
      db.collection("pedidosCanciones").get(),
      20000,
      "Firebase demoró demasiado al leer pedidos"
    );

    const pendientes = todos.docs
      .filter(doc => doc.data().estado === "pendiente")
      .filter(doc => !enviadosEnEstaSesion.has(doc.id))
      .sort((a, b) => {
        const fechaA = a.data().creadoEn?.toMillis?.() || 0;
        const fechaB = b.data().creadoEn?.toMillis?.() || 0;
        return fechaA - fechaB;
      });

    if (!pendientes.length) return;

    console.log(`Pedidos pendientes encontrados: ${pendientes.length}`);

    for (const documento of pendientes) {
      const pedido = documento.data();

      const mensaje = [
        pedido.nombre ? `Pidió ${pedido.nombre}` : "",
        pedido.ciudad ? `desde ${pedido.ciudad}` : "",
        pedido.mensaje || ""
      ].filter(Boolean).join(" — ");

      console.log(`Enviando: ${pedido.artista || "Artista desconocido"} - ${pedido.titulo || "Sin título"}`);
      console.log(`Archivo: ${pedido.archivo}`);

      try {
        await enviarARadioBoss(pedido.archivo, mensaje);
        enviadosEnEstaSesion.add(documento.id);
        console.log("✔ ENVIADO A RADIOBOSS");

        try {
          await publicarPopup(documento, pedido);
          console.log("✔ Popup publicado en la web");
        } catch (errorPopup) {
          console.log(`⚠ RadioBOSS lo recibió, pero no se pudo publicar el popup: ${errorPopup.message}`);
        }

        try {
          await conTiempoLimite(
            documento.ref.update({
              estado: "enviado",
              enviadoEn: admin.firestore.FieldValue.serverTimestamp(),
              error: admin.firestore.FieldValue.delete()
            }),
            15000,
            "Firebase demoró al marcar el pedido como enviado"
          );
          console.log("✔ Pedido marcado como enviado en Firebase");
        } catch (errorFirebase) {
          console.log(`⚠ RadioBOSS lo recibió, pero Firebase no pudo actualizar el estado: ${errorFirebase.message}`);
        }
      } catch (error) {
        console.error(`✘ ERROR AL ENVIAR A RADIOBOSS: ${error.message}`);
      }
    }
  } catch (error) {
    console.error(`✘ Error al leer Firebase: ${error.message}`);
  } finally {
    ocupado = false;
  }
}

const intervalo = Math.max(
  3,
  Number(config.pedidos?.intervaloSegundos || 5)
) * 1000;

console.log("==============================================");
console.log(" PUENTE RADIO TIEMPO MUERTO → RADIOBOSS");
console.log("==============================================");
console.log(`Firebase: ${credencial.project_id}`);
console.log(`RadioBOSS: ${config.radioBoss.host}:${config.radioBoss.puerto}`);
console.log("Esperando pedidos pendientes...");
console.log("");

procesarPedidos();
setInterval(procesarPedidos, intervalo);
