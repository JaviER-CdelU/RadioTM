# Automatizaciones de Radio Tiempo Muerto

Archivos importantes:

- `.github/workflows/actualizar-rio.yml`
- `.github/workflows/actualizar-noticias.yml`
- `scripts/actualizar_rio.py`
- `scripts/actualizar_noticias.py`

Después de subirlos, deben aparecer en **GitHub → Actions** como:

- Actualizar datos del río
- Actualizar noticias

Los dos flujos pueden ejecutarse manualmente con **Run workflow** y también quedan programados.

Si una ejecución falla al hacer `git push` o al volver a publicar GitHub Pages, revisar:

**Settings → Actions → General → Workflow permissions → Read and write permissions**.
