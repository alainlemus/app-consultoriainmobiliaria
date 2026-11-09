/** Inicio de la app según el rol del usuario staff (asesor/super_admin vs gestor) y cambio de interfaz con ambos roles. */
import * as SecureStore from 'expo-secure-store';
import {
  esGestor, esAsesor, esSoloGestor, tieneAmbasInterfaces, inicioStaff, inicioStaffCacheado,
  getInterfazGuardada, guardarInterfaz, limpiarInterfaz, INTERFAZ_KEY,
} from '../../src/utils/rolStaff';

beforeEach(() => jest.clearAllMocks());

describe('rolStaff', () => {
  it('detecta al gestor con roles en arreglo u objeto', () => {
    expect(esGestor({ roles: ['gestor'] })).toBe(true);
    expect(esGestor({ roles: { 0: 'gestor' } as unknown as string[] })).toBe(true);
    expect(esGestor({ roles: ['asesor'] })).toBe(false);
    expect(esGestor(null)).toBe(false);
  });

  it('distingue asesor, solo gestor y ambos roles', () => {
    expect(esAsesor({ roles: ['asesor'] })).toBe(true);
    expect(esAsesor({ roles: ['super_admin'] })).toBe(true);
    expect(esAsesor({ roles: ['gestor'] })).toBe(false);
    expect(esSoloGestor({ roles: ['gestor'] })).toBe(true);
    expect(esSoloGestor({ roles: ['gestor', 'asesor'] })).toBe(false);
    expect(tieneAmbasInterfaces({ roles: ['gestor', 'asesor'] })).toBe(true);
    expect(tieneAmbasInterfaces({ roles: ['gestor'] })).toBe(false);
    expect(tieneAmbasInterfaces({ roles: ['asesor'] })).toBe(false);
  });

  it('manda al gestor a sus pantallas y al resto a las del asesor', () => {
    expect(inicioStaff({ roles: ['gestor'] })).toBe('/(gestor)');
    expect(inicioStaff({ roles: ['super_admin'] })).toBe('/(tabs)');
    expect(inicioStaff(undefined)).toBe('/(tabs)');
  });

  it('con ambos roles manda la interfaz preferida y, sin preferencia, gestor', () => {
    const dual = { roles: ['gestor', 'asesor'] };
    expect(inicioStaff(dual, 'asesor')).toBe('/(tabs)');
    expect(inicioStaff(dual, 'gestor')).toBe('/(gestor)');
    expect(inicioStaff(dual)).toBe('/(gestor)');
    // Un solo rol ignora la preferencia: un asesor no puede "elegir" gestor
    expect(inicioStaff({ roles: ['asesor'] }, 'gestor')).toBe('/(tabs)');
    expect(inicioStaff({ roles: ['gestor'] }, 'asesor')).toBe('/(gestor)');
  });

  it('guarda, lee y limpia la interfaz elegida', async () => {
    await guardarInterfaz('asesor');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(INTERFAZ_KEY, 'asesor');

    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('asesor');
    expect(await getInterfazGuardada()).toBe('asesor');
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('otra-cosa');
    expect(await getInterfazGuardada()).toBeNull();

    await limpiarInterfaz();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(INTERFAZ_KEY);
  });

  it('al abrir la app usa el perfil cacheado y la interfaz guardada', async () => {
    (SecureStore.getItemAsync as jest.Mock)
      .mockResolvedValueOnce(JSON.stringify({ roles: ['gestor'] }))   // cached_user
      .mockResolvedValueOnce(null);                                    // interfaz
    expect(await inicioStaffCacheado()).toBe('/(gestor)');

    (SecureStore.getItemAsync as jest.Mock)
      .mockResolvedValueOnce(JSON.stringify({ roles: ['gestor', 'asesor'] }))
      .mockResolvedValueOnce('asesor');
    expect(await inicioStaffCacheado()).toBe('/(tabs)');

    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    expect(await inicioStaffCacheado()).toBe('/(tabs)');
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('{no es json');
    expect(await inicioStaffCacheado()).toBe('/(tabs)');
  });
});
