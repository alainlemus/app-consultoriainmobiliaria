# Changelog

Formato: cada versión publicada en tienda. Ver `RELEASING.md`.

## [Sin publicar]

### Cambiado
- Flujo simplificado: el asesor solo registra prospectos y sube o escanea sus documentos. Se quitan las pestañas Expedientes y Comisiones, el estado y la etapa del trámite, el checklist por secciones y el rechazo de documentos; el expediente se crea solo en el servidor con el primer documento.
- Nuevo prospecto: solo pide el nombre (teléfono, correo y notas opcionales); CURP, foto, estado, escuela y precalificación quedan en "Más datos (opcional)". El servicio queda fijo en FOVISSSTE.
- El detalle del prospecto tiene la sección Documentos (escanear o subir PDF/foto, ver y eliminar). Se pueden subir varios del mismo tipo.
- Inicio muestra prospectos con y sin documentos; Perfil ya no pide banco ni CLABE.

- App del acreditado: su trámite aparece "En revisión"; se quitan la barra de etapas y la pestaña Seguimiento.

Solo cambia JavaScript (llega como actualización automática). Requiere el servidor con `POST /contactos/{id}/documentos`: desplegar el backend antes.

## [2.2.1] - 2026-09-29

### Agregado
- Actualizaciones OTA con EAS Update (canales `staging` y `production`,
  runtime por `fingerprint`).
- Despliegue automático con EAS Workflows: push a `develop` → staging,
  push a `main` → App Store (update OTA o build según el fingerprint).

### Corregido
- Contrato de prestación de servicios: ya no se cortan los nombres del jurídico
  y del obligado solidario; paginación con pie de página en cada hoja
  ("Hoja X de N"); las firmas nunca quedan solas en una hoja (carta y oficio);
  márgenes laterales parejos.
- Contrato: ya no se duplica la fecha en la introducción ni el título
  ("LIC. LIC.", "C. LIC.") en las firmas.
- Build de iOS: declaración de encriptación exenta en la config.
- Fingerprint igual en local y en EAS (se ignora el `build.gradle` parcheado de
  `react-native-image-to-pdf`).

### Cambiado
- La versión se lleva solo en `package.json`; números de build automáticos en EAS.
- Variables de entorno movidas de `eas.json` a los ambientes de EAS.
