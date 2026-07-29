# EMPEZAR AQUÍ — Radio Tiempo Muerto

## Por qué los pedidos todavía no llegan

La prueba manual funcionó porque Chrome y RadioBOSS estaban en la misma computadora:

`127.0.0.1:9000`

La web publicada en GitHub no puede entrar directamente a esa dirección. Por eso el sistema correcto es:

**Web → Firebase → puente de esta computadora → RadioBOSS**

Firebase recibe el pedido desde internet. El puente lo descarga y lo envía localmente a RadioBOSS.

---

# PARTE A — Lo que se sube a GitHub

Subir el contenido de la carpeta:

`web/`

Archivos principales:

- `pedidos.html`
- `admin-pedidos.html`
- `css/pedidos.css`
- `js/pedidos.js`
- `js/admin-pedidos.js`
- `js/firebase-config.js`

En el `index.html` actual agregar cerca del reproductor:

```html
<a href="pedidos.html">🎵 Pedir una canción</a>
```

No reemplazar toda la página.

---

# PARTE B — Lo que queda en la computadora de la radio

La carpeta:

`puente-radio/`

No subir a GitHub:

- `config.json`
- `serviceAccountKey.json`
- `node_modules`

Orden correcto:

1. Instalar Node.js LTS.
2. Ejecutar `INSTALAR.bat`.
3. Copiar `config.example.json` como `config.json`.
4. Completar contraseña de RadioBOSS y carpetas de música.
5. Colocar `serviceAccountKey.json`.
6. Ejecutar `VERIFICAR_CONEXION.bat`.
7. Ejecutar `ACTUALIZAR_CATALOGO.bat`.
8. Ejecutar `INICIAR_PUENTE.bat`.
9. Dejar abierta la ventana del puente mientras la radio esté funcionando.

---

# Qué mostrará la web

Cada resultado mostrará:

- artista;
- título;
- duración;
- álbum, cuando exista;
- botón “Pedir”.

La ruta real del archivo queda oculta para el oyente.

---

# Qué debe pasar con un pedido

1. El oyente elige una canción.
2. Escribe nombre, ciudad y saludo.
3. El pedido queda `pendiente` en Firebase.
4. El operador entra a `admin-pedidos.html`.
5. Aprueba el pedido.
6. El puente detecta el estado `aprobado`.
7. RadioBOSS recibe `action=songrequest`.
8. Aparece en “Canciones solicitadas”.

Mientras el puente no esté iniciado, los pedidos podrán quedar guardados en Firebase, pero no llegarán a RadioBOSS.
