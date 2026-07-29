const fs = require("fs");
const http = require("http");

function fallo(texto) {
  console.error("✘ " + texto);
  process.exitCode = 1;
}

if (!fs.existsSync("./config.json")) {
  fallo("Falta config.json. Copiá config.example.json y completalo.");
  process.exit();
}

const config = JSON.parse(fs.readFileSync("./config.json", "utf8"));

if (!fs.existsSync(`./${config.firebase.serviceAccount}`)) {
  fallo(`Falta ${config.firebase.serviceAccount}. Debe estar en esta carpeta y NO se sube a GitHub.`);
}

const qs = new URLSearchParams({
  pass: config.radioBoss.contrasena,
  cmd: "play"
});

const req = http.request({
  hostname: config.radioBoss.host,
  port: config.radioBoss.puerto,
  path: `/?${qs.toString()}`,
  method: "GET",
  timeout: 5000
}, res => {
  let cuerpo = "";
  res.on("data", x => cuerpo += x);
  res.on("end", () => {
    if (cuerpo.trim() === "OK") {
      console.log("✔ RadioBOSS responde correctamente.");
      console.log("✔ Puerto y contraseña correctos.");
      console.log("Ahora ejecutá ACTUALIZAR_CATALOGO.bat y después INICIAR_PUENTE.bat.");
    } else {
      fallo(`RadioBOSS respondió: ${cuerpo.trim() || "sin respuesta"}`);
    }
  });
});

req.on("timeout", () => req.destroy(new Error("Tiempo agotado")));
req.on("error", e => fallo(`No se pudo conectar con RadioBOSS: ${e.message}`));
req.end();
