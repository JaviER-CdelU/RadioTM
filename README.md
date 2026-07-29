# Radio Tiempo Muerto

Sitio web oficial de Radio Tiempo Muerto.

Incluye radio en vivo, noticias, comunidad, corresponsales, podcasts, clima, altura del río, aportes, contacto, ayuda y paneles de administración.

**Contacto**
- Correo: rtiempomuerto@gmail.com
- WhatsApp: +54 9 3442 405972


## Firebase

La aplicación web está conectada al proyecto Firebase. Para habilitar el administrador deben activarse Authentication con Google, Firestore y sus reglas de seguridad.


Versión técnica: Firebase conectado + corrección de caché v2.


## Actualizaciones automáticas

- Clima: Open-Meteo, cada 15 minutos mientras la web está abierta.
- Río Uruguay: Prefectura Naval Argentina, consulta de GitHub Actions cada 30 minutos.
- Noticias: fuentes activas de Firebase, consulta de GitHub Actions aproximadamente cada hora.
- Facebook e Instagram: requieren selección manual o la integración oficial de Meta.


## Noticias y redes sociales

- Los sitios web y RSS se revisan aproximadamente cada hora mediante `.github/workflows/actualizar-noticias.yml`.
- La portada muestra un carrusel de noticias destacadas y `noticias.html` ofrece lectura por zona y fuente.
- Facebook e Instagram tienen un flujo preparado cada 12 horas en `.github/workflows/actualizar-redes.yml`.
- Para activar Meta hay que crear en GitHub Actions los secretos `META_PAGE_ACCESS_TOKEN` y `META_ACCOUNTS_JSON`. No se deben escribir tokens dentro del repositorio público.
- La integración automática solo funciona para cuentas y páginas autorizadas por Meta; las fuentes sin autorización quedan para selección manual.
