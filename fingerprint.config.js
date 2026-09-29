/**
 * Config de @expo/fingerprint (runtimeVersion policy 'fingerprint').
 *
 * El plugin withFixImageToPdf (app.config.ts) reescribe el build.gradle de
 * react-native-image-to-pdf dentro de node_modules durante el prebuild. En la
 * Mac ese archivo ya queda parcheado de builds anteriores; en EAS llega limpio
 * cuando se calcula el fingerprint → runtime distinto local vs EAS y los
 * `eas update` publicados desde la Mac no le llegarían al build.
 * Se ignora porque su contenido final siempre lo fija el plugin.
 */
/** @type {import('expo/fingerprint').Config} */
const config = {
  ignorePaths: ['node_modules/react-native-image-to-pdf/android/build.gradle'],
};

module.exports = config;
