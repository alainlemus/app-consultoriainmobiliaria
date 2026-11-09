import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { InstallReferrerInfo } from './InstallReferrer.types';

declare class InstallReferrerModule extends NativeModule {
  /** null si Play Store no tiene dato (sin liga, sideload, emulador) o si falla. Nunca rechaza. */
  getReferrerAsync(): Promise<InstallReferrerInfo | null>;
}

// Módulo solo Android (expo-module.config.json). En iOS no existe: `requireOptionalNativeModule`
// regresa null en vez de tronar, y el servicio de atribución lo trata como "sin dato".
export default requireOptionalNativeModule<InstallReferrerModule>('InstallReferrer');
