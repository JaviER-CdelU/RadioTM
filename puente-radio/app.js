const fs = require("fs");
const http = require("http");
const admin = require("firebase-admin");

function cargarJson(nombre) {
  if (!fs.existsSync(nombre)) {
    throw new Error(`Falta el archivo ${nombre}. Revisá PASO_A_PASO.md`);
  }
  return JSON.parse(fs.readFileSync(nombre, "utf8"));
}

const config = cargarJson("./config.json");
const credencial = cargarJson(`./${config.firebase.serviceAccount}`);

admin.initializeApp({
  credential: admin.credential.cert(credencial)
});

const db = admin.firestore();
let trabajando = false;

function llamarRadioBoss(archivo, mensaje) {
  return new Promise((resolve, reject) => {
    const parametros = new URLSearchParams({
      pass: config.radioBoss.contrasena,
      action: "songrequest",
      filename: archivo,
      message: mensaje || ""
    });

    const opciones = {
      hostname: config.radioBoss.host,
      port: config.radioBoss.puerto,
      path: `/?${parametros.toString()}`,
      method: "GET",
      timeout: 10000
    };

    const req = http.request(opciones, (res) => {
      let cuerpo = "";
      res.on("data", (trozo) => cuerpo += trozo);
      res.on("end", () => {
        const respuesta = cuerpo.trim();
        if (respuesta === "OK") resolve(respuesta);
        else reject(new Error(`RadioBOSS respondió: ${respuesta || "sin respuesta"}`));
      });
    });

    req.on("timeout", () => req.destroy(new Error("RadioBOSS no respondió a tiempo")));
    req.on("error", reject);
    req.end();
  });
}

async function procesarPedidos() {
  if (trabajando) return;
  trabajando = true;

  try {
    const estadoBuscado = config.pedidos.aprobarAutomaticamente ? "pendiente" : "aprobado";
    const snap = await db.collection("pedidosCanciones")
      .where("estado", "==", estadoBuscado)
      .orderBy("creadoEn", "asc")
      .limit(10)
      .get();

    for (const documento of snap.docs) {
      const pedido = documento.data();
      const ref = documento.ref;

      try {
        await ref.update({
          estado: "procesando",
          procesandoEn: admin.firestore.FieldValue.serverTimestamp()
        });

        const mensaje = [
          pedido.nombre ? `Pidió ${pedido.nombre}` : "",
          pedido.ciudad ? `desde ${pedido.ciudad}` : "",
          pedido.mensaje || ""
        ].filter(Boolean).join(" — ");

        await llamarRadioBoss(pedido.archivo, mensaje);

        await ref.update({
          estado: "enviado",
          enviadoARadioBossEn: admin.firestore.FieldValue.serverTimestamp(),
          error: admin.firestore.FieldValue.delete()
        });

        console.log(`✔ Enviado: ${pedido.artista} - ${pedido.titulo}`);
      } catch (error) {
        console.error(`✘ Error en pedido ${documento.id}:`, error.message);
        await ref.update({
          estado: "error",
          error: error.message,
          errorEn: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }
  } catch (error) {
    console.error("Error general:", error.message);
  } finally {
    trabajando = false;
  }
}

const intervalo = Math.max(2, Number(config.pedidos.intervaloSegundos || 4)) * 1000;
console.log("Puente iniciado.");
console.log(`RadioBOSS: ${config.radioBoss.host}:${config.radioBoss.puerto}`);
console.log(`Modo: ${config.pedidos.aprobarAutomaticamente ? "automático" : "con aprobación"}`);

procesarPedidos();
setInterval(procesarPedidos, intervalo);
