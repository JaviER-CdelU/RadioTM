# Instalación paso a paso

## Parte 1 — Preparar Firebase

1. Entrá a la consola de Firebase.
2. Abrí el proyecto que ya usa Radio Tiempo Muerto.
3. Activá:
   - Firestore Database.
   - Authentication.
   - Proveedor Google en Authentication.
4. En “Configuración del proyecto” → “Tus aplicaciones” → aplicación web:
   copiá la configuración de Firebase.
5. En `web/js/`:
   - copiá `firebase-config.example.js`;
   - renombralo a `firebase-config.js`;
   - reemplazá los datos de ejemplo.
6. Publicá las reglas de `firebase/firestore.rules`.
7. Creá los índices indicados en `firebase/firestore.indexes.json`.
   Firebase también puede mostrarte un enlace para crearlos automáticamente la primera vez que una consulta los necesite.

## Parte 2 — Obtener la llave privada para la computadora de la radio

1. Firebase → Configuración del proyecto.
2. Cuentas de servicio.
3. “Generar nueva clave privada”.
4. Guardá el archivo descargado dentro de `puente-radio/`.
5. Renombralo exactamente:
   `serviceAccountKey.json`
6. No lo subas a GitHub.

## Parte 3 — Configurar el puente

1. Instalá Node.js versión LTS en la computadora donde funciona RadioBOSS.
2. Dentro de `puente-radio/`:
   - copiá `config.example.json`;
   - renombralo `config.json`.
3. Abrí `config.json` con el Bloc de notas.
4. Cambiá:
   - contraseña de RadioBOSS;
   - carpetas de música.
5. Antes de publicar el sistema, cambiá en RadioBOSS la contraseña `1` por una contraseña larga.
6. Ejecutá `INSTALAR.bat`.

Ejemplo de carpetas:

```json
"carpetas": [
  "E:\\angela",
  "E:\\03 - Top 50 Spotify Septiembre 2024-20240906T162610Z-001"
]
```

También se puede usar `"E:\\"`, pero el primer escaneo puede demorar bastante.

## Parte 4 — Subir el catálogo de música

1. RadioBOSS puede quedar abierto.
2. Ejecutá `ACTUALIZAR_CATALOGO.bat`.
3. El programa recorrerá las carpetas, leerá artista y título y cargará la colección `canciones` en Firestore.
4. Volvé a ejecutarlo cuando agregues mucha música nueva.

## Parte 5 — Probar la página pública

1. Abrí `web/pedidos.html` desde un servidor web o después de subirla a GitHub Pages.
2. Buscá una canción.
3. Completá nombre, ciudad y mensaje.
4. El pedido aparecerá en Firestore con estado `pendiente`.

## Parte 6 — Panel del operador

1. Abrí `web/admin-pedidos.html`.
2. Ingresá con Google.
3. Aprobá un pedido.
4. El pedido quedará con estado `aprobado`.

Las reglas incluidas permiten el panel a cualquier usuario autenticado. Para máxima seguridad,
después conviene limitar el acceso a correos administradores concretos.

## Parte 7 — Enviar a RadioBOSS

1. Abrí RadioBOSS.
2. Confirmá:
   - API habilitada;
   - puerto 9000;
   - contraseña igual a la de `config.json`.
3. Ejecutá `INICIAR_PUENTE.bat`.
4. Dejá esa ventana abierta mientras la radio esté funcionando.
5. Al aprobar un pedido, el puente lo enviará a:
   `action=songrequest`
6. En RadioBOSS abrí “Canciones solicitadas” y presioná “Actualizar”.

## Reproducción automática

En el Planificador de RadioBOSS se puede crear un evento con el comando:

`playrequestedsong`

Elegí cada cuántos minutos querés permitir una canción pedida. Conviene probar primero de forma manual.

## Modo automático sin aprobación

En `config.json`:

```json
"aprobarAutomaticamente": true
```

El puente tomará directamente los pedidos `pendientes`. Para empezar, se recomienda `false`.
