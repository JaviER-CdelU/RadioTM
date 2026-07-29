# Radio Tiempo Muerto — Sistema profesional de pedidos

Este proyecto conecta:

1. La web publicada en GitHub Pages.
2. Firebase/Firestore.
3. Un programa puente ejecutándose en la computadora de la radio.
4. RadioBOSS 6.0.3.1 mediante su API local.

## Flujo

Oyente → Web → Firestore → Panel del operador → Programa puente → RadioBOSS → Canciones solicitadas

La conexión local con RadioBOSS ya fue comprobada con:

- Puerto: 9000
- Acción: `songrequest`
- Resultado: el pedido apareció en “Canciones solicitadas”.

## Carpetas

- `web/`: página pública para buscar y pedir canciones, y panel del operador.
- `puente-radio/`: programa que corre en la PC donde está RadioBOSS.
- `firebase/`: reglas e índices recomendados.
- `PASO_A_PASO.md`: instrucciones completas en castellano.
- `INTEGRAR_EN_GITHUB.md`: cómo agregarlo a la web existente.

## Seguridad importante

No subas jamás a GitHub:

- `serviceAccountKey.json`
- la contraseña de la API de RadioBOSS
- `config.json` del puente

Esos archivos quedan únicamente en la computadora de la radio.
