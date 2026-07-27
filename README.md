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
