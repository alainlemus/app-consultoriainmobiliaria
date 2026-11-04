/** Inicio de la app según el rol del usuario staff (asesor/super_admin vs gestor). */
import * as SecureStore from 'expo-secure-store';
import { esGestor, inicioStaff, inicioStaffCacheado } from '../../src/utils/rolStaff';

describe('rolStaff', () => {
  it('detecta al gestor con roles en arreglo u objeto', () => {
    expect(esGestor({ roles: ['gestor'] })).toBe(true);
    expect(esGestor({ roles: { 0: 'gestor' } as unknown as string[] })).toBe(true);
    expect(esGestor({ roles: ['asesor'] })).toBe(false);
    expect(esGestor(null)).toBe(false);
  });

  it('manda al gestor a sus pantallas y al resto a las del asesor', () => {
    expect(inicioStaff({ roles: ['gestor'] })).toBe('/(gestor)');
    expect(inicioStaff({ roles: ['super_admin'] })).toBe('/(tabs)');
    expect(inicioStaff(undefined)).toBe('/(tabs)');
  });

  it('al abrir la app usa el perfil cacheado y, si no hay, el inicio del asesor', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(JSON.stringify({ roles: ['gestor'] }));
    expect(await inicioStaffCacheado()).toBe('/(gestor)');
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);
    expect(await inicioStaffCacheado()).toBe('/(tabs)');
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('{no es json');
    expect(await inicioStaffCacheado()).toBe('/(tabs)');
  });
});
