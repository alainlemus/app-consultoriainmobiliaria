# Changelog

Formato: cada versión publicada en tienda. Ver `RELEASING.md`.

## [Sin publicar]

### Corregido
- Contrato de prestación de servicios: ya no se cortan los nombres del jurídico
  y del obligado solidario; paginación con pie de página en cada hoja
  ("Hoja X de N"); las firmas nunca quedan solas en una hoja (carta y oficio);
  márgenes laterales parejos.
- Contrato: ya no se duplica la fecha en la introducción ni el título
  ("LIC. LIC.", "C. LIC.") en las firmas.

### Cambiado
- La versión se lleva solo en `package.json`; números de build automáticos en EAS.
- Despliegue automático con EAS Workflows: push a `develop` → staging,
  push a `main` → App Store (update OTA o build según el fingerprint).
- Variables de entorno movidas de `eas.json` a los ambientes de EAS.

## [2.2.1]

### Agregado
- Actualizaciones OTA con EAS Update (canales `staging` y `production`,
  runtime por `fingerprint`).

### Corregido
- Build de iOS: declaración de encriptación exenta en la config.
- Fingerprint igual en local y en EAS (se ignora el `build.gradle` parcheado de
  `react-native-image-to-pdf`).
