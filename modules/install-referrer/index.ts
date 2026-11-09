// Módulo nativo local (solo Android): lee el Play Install Referrer.
// En iOS el default es null. Ver src/services/atribucion.ts para el uso.
export { default } from './src/InstallReferrerModule';
export * from './src/InstallReferrer.types';
