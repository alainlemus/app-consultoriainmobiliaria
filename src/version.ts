import Constants from 'expo-constants';
import pkg from '../package.json';

/** Versión de la app: la del manifiesto, o la de package.json si el manifiesto no la trae (p. ej. Expo Go). */
export const APP_VERSION: string = Constants.expoConfig?.version ?? pkg.version;
