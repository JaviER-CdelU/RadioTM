# Integración con el repositorio RadioTM

## Archivos para subir

Copiá desde la carpeta `web/` al directorio principal del repositorio:

- `pedidos.html`
- `admin-pedidos.html`
- carpeta `css/` (o únicamente `css/pedidos.css`)
- carpeta `js/`:
  - `pedidos.js`
  - `admin-pedidos.js`
  - `firebase-config.js` después de completarlo

## Enlace desde la página principal

En `index.html`, buscá el botón o tarjeta que dice “Pedí tu música”.

Cambiale el enlace para que apunte a:

```html
<a href="pedidos.html">Pedí tu música</a>
```

En el menú de administrador podés agregar:

```html
<a href="admin-pedidos.html">Pedidos de canciones</a>
```

## Qué NO subir

La carpeta `puente-radio/` puede guardarse en GitHub solo si se respetan `.gitignore`
y las siguientes exclusiones:

- `config.json`
- `serviceAccountKey.json`
- `node_modules/`

La opción más simple y segura es conservar `puente-radio/` únicamente en la computadora de la radio.

## Publicación

Después de confirmar los cambios en la rama principal, GitHub Pages suele actualizar la web en uno o dos minutos.
