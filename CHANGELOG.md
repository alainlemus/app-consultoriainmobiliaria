# Changelog

Formato: cada versión publicada en tienda. Ver `RELEASING.md`.

## [Sin publicar]

### Corregido
- Contrato de prestación de servicios: el encabezado ahora es idéntico al del contrato del panel (título en una sola línea con las mismas proporciones, y el folio "Expediente: …" alineado a la derecha, que salía a la izquierda).

## [2.3.0] - 2026-10-13

### Cambiado
- Flujo simplificado: el prospecto es quien se está evaluando y el expediente es del cliente. El asesor registra prospectos y, al volverse cliente, abre su expediente y sube o escanea ahí los documentos. Se quita la pestaña Comisiones y en los expedientes ya no hay estado, etapa, checklist por secciones ni rechazo de documentos.
- Expedientes: lista simple con el número de documentos y un detalle con la lista de documentos (escanear o subir PDF/foto, ver y eliminar; se pueden subir varios del mismo tipo).
- Nuevo prospecto: solo el nombre es obligatorio y los demás campos (CURP, estado y precalificación) están a la vista como opcionales; ya no se pide escuela ni foto. Campos de texto en caja con borde y listas con flecha. Al guardar sale un aviso, en línea o sin conexión. El servicio queda fijo en FOVISSSTE.
- Inicio muestra prospectos y expedientes; "Rastreo de ubicación" ahora es "Ruta" (captura la ruta conforme a las ubicaciones registradas). Perfil ya no pide banco ni CLABE.
- Avisos: al validar o rechazar un documento llega una notificación al asesor; al validar todos los documentos llega "Expediente completo". Al subir documentos se avisa a los administradores. Los expedientes completos ya no se ven en la app (solo en el panel). El administrador puede enviarse por correo la carpeta del expediente (ZIP, enlace de 72 horas) desde el expediente.
- Contratos: ahora todos los asesores pueden generarlos (Inicio → Contratos) y ven su propio historial; editar la plantilla sigue siendo solo del administrador.
- Mapa: los filtros (Todos, Cliente, Propiedad, Escuela y Anuncios) ahora son uno solo y exclusivo: cada opción muestra únicamente lo suyo, con su cantidad, la búsqueda respeta el filtro, el mapa se ajusta a lo visible y los pines ya no se quedan vacíos. El filtro de asesor (admin) también filtra los anuncios.
- Mapa: los pines llevan el icono en blanco sobre el color de su tipo (antes el icono se veía blanco sobre blanco).
- Documentos: cada uno muestra su validación (En revisión, Validado o Rechazado con el motivo); solo un administrador valida o rechaza. Se pueden subir varios del mismo tipo y la nota los identifica. Antes de subir sale un aviso con los requisitos del documento. Los expedientes ya no llevan foto y todos los emojis se cambiaron por iconos.
- App del acreditado: su trámite aparece "En revisión"; se quitan la barra de etapas y la pestaña Seguimiento.

Solo cambia JavaScript (llega como actualización automática). Requiere el servidor con los cambios de documentos por expediente: desplegar el backend antes.

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
