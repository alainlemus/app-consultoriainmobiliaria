# Changelog

Formato: cada versión publicada en tienda. Ver `RELEASING.md`.

## [Sin publicar]

### Agregado
- Notificaciones: campana con contador en el inicio del asesor, del gestor y del acreditado, y bandeja con el historial completo (leídas y no leídas, texto íntegro). Solo lectura: se marcan al abrir, no se borran. Requiere backend 1.15.0.
- Seguimiento del trámite en 7 pasos, igual para el acreditado (en Mi trámite) y el asesor (en el expediente): Validación de documentos → Trámites en gestión → Trámites gestionados → En unidad de valuación → Recurso en gestión → Firma → Crédito entregado. El texto de cada paso lo edita la oficina.
- CUV: el acreditado y el asesor la ven en el expediente; el super admin la registra desde la app (16 dígitos y foto opcional) igual que el gestor desde su encargo. Al registrarla avisa a todos.
- Super admin: botones «Enviado a unidad de valuación», «Registrar CUV» y «Marcar firma» en el expediente, cada uno visible solo en el paso del seguimiento que le toca.
- Llamar y WhatsApp en la ficha del prospecto y del expediente, y «Agendar cita» desde ambas.
- Citas: el asesor agenda para su cliente y el acreditado con su asesor (oficina o domicilio, eligiendo día y hora libre); el super admin ve su agenda, confirma, reagenda, cancela y marca asistencia. Recordatorios automáticos. Requiere backend 1.16.0.
- Documentos validados, de gestor o la CUV: el asesor solo los ve; ya no aparecen Reemplazar ni Eliminar.
- Acreditado: si se registró sin código, puede ligar su «código de asesor» después desde Perfil → Mi asesor (y un aviso en el inicio se lo recuerda). Requiere backend 1.13.0.
- Acreditado: la tarjeta «Tu asesor» ya permite llamar o escribir por WhatsApp, también antes de tener expediente.
- Asesor: pantalla «Registrados QR» con las cuentas creadas con su código y en qué paso van (solo registrado, pidió asesoría, con expediente), con llamar, WhatsApp y acceso al prospecto. La notificación «Se registró con tu código QR» abre esa lista.
- Quien es gestor y asesor a la vez entra con el botón que elija («Soy Asesor» o «Soy Gestor») y puede cambiar de interfaz desde Perfil sin cerrar sesión. La app recuerda la última interfaz al volver a abrirla. Requiere backend 1.12.3.

## [2.10.0] - 2026-11-09

### Agregado
- Acreditado: campo «Código de asesor» al crear la cuenta. Es el código impreso junto al QR de la lona, tarjeta o volante; al escribirlo la app confirma «Tu asesor será X» y la cuenta queda ligada a ese asesor, que lleva el trámite. Requiere backend 1.12.0.
- Acreditado: tarjeta «Tu asesor» en la pantalla principal cuando la cuenta se creó con código.
- El registro acepta `?codigo=` en la liga para precargar el código (preparado para abrir la app desde el QR).
- El código de asesor se detecta solo al instalar: en Android lo entrega Play Store (Install Referrer, módulo nativo local `modules/install-referrer`); en iPhone, o si Play Store no trae dato, el backend lo cruza con los escaneos recientes. Se precarga en el registro con aviso «Lo tomamos del QR que escaneaste; puedes cambiarlo». Requiere build nuevo (módulo nativo) y backend 1.12.0.
- Si la app ya está instalada, escanear un QR de asesor la abre directo (universal links en iPhone, app links en Android) y lleva al registro con el código puesto; con sesión abierta, va al inicio de cada quien.

## [2.9.0] - 2026-11-06

### Agregado
- Gestor: botón «Ya terminé» para avisar que entregó todo, estado «Por validar» y «Reabrir» si olvidó algo. Requiere backend 1.11.0.
- Gestor: «Cancelar mi cuenta» en su Perfil.

### Corregido
- Cerrar y abrir la app ya no saca a quien tiene la misma cuenta abierta en otro celular: cada instalación tiene su propia sesión.
- Acreditado: el nombre del documento ya no se corta en «Rechazado»; el estado va debajo del nombre.
- Gestor: el texto del botón «Empezar trámite» ya no se sale del botón.

## [2.8.0] - 2026-11-04

### Agregado
- **Primeros pasos del acreditado:** quien aún no tiene trámite elige Infonavit o Fovissste (o «No sé» y contesta dónde trabaja), revisa si ya tiene cuenta en Mi Cuenta Infonavit o Mi Portal FOVISSSTE (con guía para crearla), simula su crédito en el simulador oficial dentro de la app, ve el video y el PDF de su crédito y pide que lo llamen, con su monto, puntos o salario y la captura del resultado. Sin señal la solicitud se guarda y se envía sola. Requiere el backend 1.9.0.
- **Rol gestor:** nuevo acceso «Soy Gestor». Ve los expedientes que le envía la administración, revisa cada documento (correcto o incorrecto con nota), empieza el trámite cuando todo está bien y sube lo que obtiene (escanear, foto, PDF o Word; sin señal queda en cola). Le llegan avisos que abren su encargo. Requiere el backend 1.10.0.

### Cambiado
- **Ruta:** el aviso al activarla explica qué hacer (activar al salir, registrar cada visita en el Mapa, apagar al terminar) y pide «Permitir mientras se usa la app». La guía de uso dice lo mismo.

### Corregido
- Al activar o apagar la ruta con GPS débil o 2G el interruptor ya no se queda «Activando…»: espera el GPS máximo 15 s y el envío corre aparte.
- Después de iniciar sesión, «Mi ruta» salía vacía y el administrador no veía sus opciones hasta reiniciar la app.

## [2.7.0] - 2026-10-30

### Agregado
- **Regresión de fases:** al generar un contrato también se arma el oficio de regresión de fases para FOVISSSTE (AT'N Hipotecaria Hogar) con los nombres del acreditado y del obligado solidario, la ciudad y la fecha; el número de crédito se llena a mano. Tiene vista previa, se puede ver, imprimir y compartir al terminar y después desde el historial de contratos (los contratos anteriores lo piden al servidor). Requiere el backend 1.7.0.

### Cambiado
- **Pagaré con el formato nuevo:** ahora incluye al deudor (nombre, domicilio e INE con clave de elector), al aval (el obligado solidario), lugar y fecha de suscripción, el acreedor con su domicilio de pago y espacio para dos testigos. El importe, el vencimiento, el % de intereses mensual y las firmas se llenan a mano.

### Corregido
- El pagaré de contratos anteriores o recuperados del servidor no se podía abrir ("no disponible"); ya se descarga del servidor.

## [2.6.0] - 2026-10-26

### Agregado
- **Pagaré en el historial de contratos:** al abrir un contrato generado ahora aparecen "Ver / Imprimir pagaré" y "Compartir pagaré". Los contratos nuevos guardan su pagaré en el teléfono (se abre sin internet); los anteriores o recuperados del servidor lo piden al servidor, que lo arma con los datos del contrato. Requiere el backend con esta función.

## [2.5.0] - 2026-10-14

### Cambiado
- Iniciar el expediente de un prospecto ahora funciona sin señal: se guarda y se crea solo al recuperar internet (después se pueden subir sus documentos).
- Documentos del acreditado guardados sin conexión: se reintentan al abrir el portal, al volver a la app y cada minuto, aunque la señal esté "conectada" pero débil, y un fallo de red ya no gasta los intentos ni los descarta.
- Notificaciones: al tocar una notificación ahora abre la pantalla que corresponde (el expediente o el prospecto para el asesor, el mapa en las visitas, Documentos para el acreditado y, si no hay una pantalla específica, el inicio), también cuando la app estaba cerrada y se abrió con la notificación. Antes, estando cerrada solo abría la app, y al acreditado lo mandaba a una pantalla que no es suya.
- App del acreditado: el botón Subir abre una pantalla nueva, como la del asesor, donde elige qué documento es (con sus requisitos), agrega una nota y lo escanea o selecciona un archivo; antes de enviar confirma que cumple. Sin conexión se guarda con su nota y se envía solo.
- App del acreditado, Documentos: ahora muestra la lista de documentos que debe subir (acta de nacimiento, INE, CURP, constancia fiscal, comprobante de domicilio, 3 talones y estado de cuenta AFORE) con sus requisitos, dónde obtenerlos y enlaces, los marca como Entregado, incluye avisos importantes y, antes de subir, un aviso para confirmar que el documento cumple.
- App del acreditado: en los datos del asesor se quita el botón de correo; quedan Llamar y WhatsApp.
- App del acreditado: si aún no tiene trámite, la pantalla se actualiza sola al volver a la app y cada 20 segundos, y se puede jalar hacia abajo aunque haya poco contenido (en iPhone no se podía jalar), para que el expediente aparezca en cuanto el asesor lo abre.
- App del acreditado: al jalar hacia abajo la pantalla ahora recarga también cuando aún no tiene trámite, así ve su expediente en cuanto el asesor lo abre (antes no recargaba y seguía mostrando que no tenía trámite).
- App del acreditado: al no tener trámite solo se ofrece el botón "Crédito FOVISSSTE" para solicitar asesoría (antes salía la lista completa de servicios). Al enviar la solicitud, o al volver a entrar, se le avisa que ya está registrado y que un asesor lo contactará (antes seguía viendo el botón).

## [2.4.0] - 2026-10-13

### Agregado
- **Enviar carpeta solo con todo validado:** el botón "Enviar carpeta a mi correo" del administrador queda deshabilitado hasta que valide todos los documentos del expediente (y los que solicitó estén subidos y validados). Si a destiempo falta un documento, desde el expediente puede solicitarlo al asesor (o al acreditado): al asesor le llega una notificación y le aparece el aviso "Te solicitaron un documento" con la nota y un botón para subirlo.
- **Documento faltante:** el administrador, desde el expediente, puede solicitar al acreditado un documento que faltaba escribiendo una nota; le llega una notificación y le aparece el aviso "Te falta un documento" en Mi Trámite con un botón para subirlo. El administrador ve también los expedientes completos para poder hacerlo. Requiere el backend con esta función.
- **Cómo capturar la INE:** al registrar un contrato se abre un aviso que explica que los datos se pueden subir con foto o capturar a mano, que no se debe fotografiar una fotocopia y cómo centrar la credencial en la cámara, con un ejemplo dibujado. Se puede volver a ver con "¿Cómo tomar la foto?".
- **Ruta olvidada:** si dejas la ruta activa, te llega un aviso a las 7 pm y a las 9 pm para desactivarla; si sigue activa pasadas las 10 pm (o al día siguiente), se desactiva sola al abrir la app.
- **Pagaré:** al generar un contrato ahora puedes ver, imprimir y compartir también el pagaré, con el formato oficial y llenado con nombre, domicilio y RFC del acreditado y la fecha del día. Importe y vencimiento quedan en blanco para llenarlos a mano.
- El pagaré es un documento aparte: se guarda como PDF propio, se sube al expediente como "Pagaré" y tiene sus propios botones de ver/imprimir y compartir.
- Antes de generar el contrato hay vista previa del contrato y del pagaré.
- El tipo de trámite del contrato es FOVISSSTE y el tamaño de hoja es Carta por defecto.

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
