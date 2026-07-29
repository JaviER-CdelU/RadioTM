# Radio Tiempo Muerto — Reproductor con artista, tema y duración

Este ZIP es un archivo real y descargable.

## Incluye

- artista actual;
- título actual;
- duración;
- posición aproximada;
- barra de progreso;
- próximo tema, cuando RadioBOSS lo informe;
- programa local que consulta RadioBOSS y publica los datos en Firebase.

## Qué va a GitHub

Copiar:

- `web/js/metadata-reproductor.js`
- `web/css/metadata-reproductor.css`

Después abrir `web/AGREGAR_AL_INDEX.html` y copiar sus tres bloques dentro del `index.html` actual.

## Qué queda en la computadora de la radio

Copiar dentro de la carpeta del puente:

- `puente-radio/metadata.js`
- `puente-radio/INICIAR_METADATA.bat`

El archivo `config.json` existente debe contener también:

```json
"metadata": {
  "intervaloSegundos": 5
}
```

## Cómo probar

1. Abrir RadioBOSS.
2. Confirmar API en puerto 9000.
3. Ejecutar `INICIAR_METADATA.bat`.
4. Dejar esa ventana abierta.
5. Abrir la web y actualizar con Ctrl + F5.

## Importante

RadioBOSS 6.0.3.1 puede devolver `playbackinfo` con nombres de campos distintos según la configuración.
El programa incluido intenta reconocer varias variantes comunes. Si artista, duración o próximo tema aparecen vacíos,
guardá la respuesta de `action=playbackinfo` y ajustamos el lector sin tocar el resto del proyecto.
