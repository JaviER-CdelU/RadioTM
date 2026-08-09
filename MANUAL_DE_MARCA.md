# Manual de marca — Radio Tiempo Muerto

Guía de referencia rápida para mantener consistencia visual y de tono cada vez que se agregue o cambie algo en el sitio.

## Identidad

- **Nombre completo:** Radio Tiempo Muerto
- **Ubicación:** Concepción del Uruguay, Entre Ríos, Argentina
- **Frase de marca:** "Sabemos dónde estamos, queremos saber dónde llegamos"
- **Bajada / qué somos:** "Música, deportes y noticias para estar siempre informados y en contacto"
- **Tono:** cercano, de barrio, dos vías con el oyente (no solo transmitir, también recibir mensajes, pedidos, fotos de corresponsales, etc.)

## Colores

| Uso | Color |
|---|---|
| Fondo header / footer (navy) | `#0d1a30` → `#132745` (degradé) |
| Acento principal (naranja) | `#ff6a13` / `#ff8a3d` → `#e9540c` |
| Noticias | naranja: `#ff8a3d` → `#e9540c` |
| Clima y Río | azul: `#4a95e6` → `#1c5bb0` |
| Publicidad | violeta: `#a565f5` → `#6c1fd0` |
| Podcast / App | rojo-naranja: `#ff7a52` → `#d8371a` |
| Agenda | turquesa: `#20b8c7` → `#0a7f96` |
| Corresponsales | rosa: `#f15fa6` → `#c81d74` |
| Franja de colaboración | cálido: `#fff3da` → `#ffe2b8`, texto `#7a3f06` |

Cada sección grande del home tiene su propio color de identificación (header del cajón + botón). No mezclar colores entre secciones.

## Tipografía y estilo de cajones

- Cada sección vive en su propio "cajón" (`dash-card`): fondo blanco, esquinas redondeadas (19px), header de color con ícono + título, cuerpo con la info esencial, botón de color al pie que lleva a la sub-página con el detalle completo.
- **Regla de oro:** el home muestra lo esencial (foto/ícono + dato clave + botón). El detalle completo vive siempre en la sub-página correspondiente (`clima-rio.html`, `noticias.html`, `podcasts.html`, etc.), no en el home.
- El reproductor en vivo es siempre visible arriba de todo (sticky), en cualquier sección del sitio.

## Estructura del home (orden de arriba a abajo)

1. Header navy con logo, menú y botón Administrador
2. Hero: foto del puente + "Radio Tiempo Muerto" + frase de marca + bajada + reproductor
3. Fila de 3 cajones grandes: Noticias / Clima y Río (fusionados) / Publicidad
4. Fila de accesos rápidos chicos: Pedí tu música, Mensajes al aire, WhatsApp, Aportes
5. Franja de colaboración (montos de aporte)
6. Fila de 4 cajones: Podcast, Agenda, Corresponsales, Nuestra app (chico)
7. Footer navy con la frase de marca y redes sociales

## Cómo agregar un cajón nuevo

1. Copiar la estructura de un `dash-card` existente (header con ícono+título+link, cuerpo, botón `dash-button` al pie).
2. Elegir un color de la tabla de arriba que no se repita en la misma fila.
3. Agregar la clase de color: `dash-card--naranja`, `dash-card--azul`, etc. (ver los nombres exactos usados en el CSS: `orange`, `blue`, `green`, `violet`, `red`, `teal`, `pink`).
4. El contenido del cajón en el home debe ser liviano: si hay mucho para mostrar, ese detalle va en una sub-página aparte, no en el cajón.

## Notas técnicas para quien edite el código

- El sitio funciona como una mini app (SPA): al hacer clic en los links del menú, el contenido se trae por atrás sin recargar toda la página. Por eso el reproductor nunca se corta al navegar.
- Los datos en vivo (clima, río, noticias) se buscan automáticamente cada cierto tiempo con `assets/js/principal.js`, buscando etiquetas `data-weather-*`, `data-river-*`, `data-news-*` en cualquier parte de la página — no hace falta tocar ese script para mover esos datos de lugar, alcanza con mover las etiquetas `data-*` a donde se necesiten.
- Publicidades y podcasts se administran desde `admin-publicidades.html` y `admin-podcasts.html` (con Google, solo la cuenta `rtiempomuerto@gmail.com`).
