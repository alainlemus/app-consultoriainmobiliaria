/**
 * Tests: src/services/notifications.ts
 *
 * Cubre:
 *  - registrarPushToken: retorna null en simulador
 *  - registrarPushToken: solicita permiso si no está granted
 *  - registrarPushToken: retorna null si permiso denegado
 *  - registrarPushToken: obtiene token, registra en backend y lo retorna
 *  - registrarPushToken: retorna null si Notifications.getExpoPushTokenAsync falla
 *  - registrarListeners: suscribe foreground y tap, retorna cleanup
 *  - mostrarNotificacionLocal: llama scheduleNotificationAsync
 *  - limpiarBadge: llama setBadgeCountAsync(0)
 */

import * as Notifications from 'expo-notifications';

// Mockeamos expo-device a nivel de módulo para controlar isDevice
jest.mock('expo-device', () => ({ isDevice: true }));
import * as Device from 'expo-device';

// Platform.OS — propiedad de solo lectura, la sobreescribimos con Object.defineProperty
import { Platform } from 'react-native';

// Mock expo-constants con un projectId válido por defecto
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        eas: { projectId: 'test-project-id' },
      },
    },
  },
}));
import Constants from 'expo-constants';

// mock de api.registrarDispositivo
jest.mock('../../src/services/api', () => ({
  registrarDispositivo: jest.fn(() => Promise.resolve()),
}));
import { registrarDispositivo } from '../../src/services/api';
const mockRegistrarDispositivo = registrarDispositivo as jest.Mock;

// mock de acreditadoApi.registrarDispositivoAcreditado
jest.mock('../../src/services/acreditadoApi', () => ({
  registrarDispositivoAcreditado: jest.fn(() => Promise.resolve()),
}));
import { registrarDispositivoAcreditado } from '../../src/services/acreditadoApi';
const mockRegistrarDispositivoAcreditado = registrarDispositivoAcreditado as jest.Mock;

import {
  registrarPushToken,
  registrarPushTokenAcreditado,
  registrarListeners,
  mostrarNotificacionLocal,
  limpiarBadge,
} from '../../src/services/notifications';

beforeEach(() => {
  jest.clearAllMocks();
  // Por defecto: dispositivo físico y permisos granted
  (Device as unknown as Record<string, unknown>).isDevice = true;
  Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
  (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
  (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({ data: 'ExponentPushToken[mock]' });
});

// ── registrarPushToken ─────────────────────────────────────────────────────

describe('registrarPushToken', () => {
  it('retorna null en simulador (Device.isDevice = false)', async () => {
    Object.defineProperty(Device, 'isDevice', { value: false, configurable: true });
    const token = await registrarPushToken();
    expect(token).toBeNull();
    expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
    // restaurar
    Object.defineProperty(Device, 'isDevice', { value: true, configurable: true });
  });

  it('solicita permiso si el estado inicial no es granted', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'undetermined' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' });
    const token = await registrarPushToken();
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    expect(token).toBe('ExponentPushToken[mock]');
  });

  it('retorna null si el permiso fue denegado', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
    const token = await registrarPushToken();
    expect(token).toBeNull();
  });

  it('obtiene token, registra en backend y lo retorna', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    const token = await registrarPushToken();
    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'test-project-id' });
    expect(mockRegistrarDispositivo).toHaveBeenCalledWith('ExponentPushToken[mock]', 'android');
    expect(token).toBe('ExponentPushToken[mock]');
  });

  it('registra como ios en iOS', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    await registrarPushToken();
    expect(mockRegistrarDispositivo).toHaveBeenCalledWith('ExponentPushToken[mock]', 'ios');
  });

  it('retorna null si no hay projectId', async () => {
    (Constants as unknown as { expoConfig: unknown }).expoConfig = { extra: { eas: { projectId: '' } } };
    const token = await registrarPushToken();
    expect(token).toBeNull();
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    // restaurar
    (Constants as unknown as { expoConfig: unknown }).expoConfig = { extra: { eas: { projectId: 'test-project-id' } } };
  });

  it('retorna null si getExpoPushTokenAsync lanza error', async () => {
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockRejectedValueOnce(new Error('token error'));
    const token = await registrarPushToken();
    expect(token).toBeNull();
  });

  it('no solicita permiso si ya está granted', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' });
    await registrarPushToken();
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});

// ── registrarPushTokenAcreditado ───────────────────────────────────────────

describe('registrarPushTokenAcreditado', () => {
  it('obtiene token y lo registra con registrarDispositivoAcreditado, no con el del asesor', async () => {
    const token = await registrarPushTokenAcreditado();
    expect(mockRegistrarDispositivoAcreditado).toHaveBeenCalledWith('ExponentPushToken[mock]', 'android');
    expect(mockRegistrarDispositivo).not.toHaveBeenCalled();
    expect(token).toBe('ExponentPushToken[mock]');
  });

  it('retorna null en simulador, igual que registrarPushToken', async () => {
    Object.defineProperty(Device, 'isDevice', { value: false, configurable: true });
    const token = await registrarPushTokenAcreditado();
    expect(token).toBeNull();
    expect(mockRegistrarDispositivoAcreditado).not.toHaveBeenCalled();
    Object.defineProperty(Device, 'isDevice', { value: true, configurable: true });
  });
});

// ── registrarListeners ─────────────────────────────────────────────────────

describe('registrarListeners', () => {
  it('suscribe listener de foreground y tap', () => {
    const mockRemove1 = jest.fn();
    const mockRemove2 = jest.fn();
    (Notifications.addNotificationReceivedListener as jest.Mock).mockReturnValueOnce({ remove: mockRemove1 });
    (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockReturnValueOnce({ remove: mockRemove2 });

    const onForeground = jest.fn();
    const onTap        = jest.fn();
    const cleanup = registrarListeners(onForeground, onTap);

    expect(Notifications.addNotificationReceivedListener).toHaveBeenCalledWith(onForeground);
    expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalledWith(onTap);

    // cleanup llama remove de ambas suscripciones
    cleanup();
    expect(mockRemove1).toHaveBeenCalled();
    expect(mockRemove2).toHaveBeenCalled();
  });
});

// ── mostrarNotificacionLocal ───────────────────────────────────────────────

describe('mostrarNotificacionLocal', () => {
  it('llama scheduleNotificationAsync con título y cuerpo correctos', async () => {
    await mostrarNotificacionLocal('Título', 'Mensaje de prueba');
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: 'Título',
          body:  'Mensaje de prueba',
        }),
        trigger: null,
      })
    );
  });

  it('incluye datos opcionales en el payload', async () => {
    const datos = { tipo: 'expediente', expediente_id: 5 };
    await mostrarNotificacionLocal('T', 'M', datos);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ data: datos }),
      })
    );
  });

  it('usa {} como datos por defecto', async () => {
    await mostrarNotificacionLocal('T', 'M');
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ data: {} }),
      })
    );
  });
});

// ── limpiarBadge ───────────────────────────────────────────────────────────

describe('limpiarBadge', () => {
  it('llama setBadgeCountAsync(0)', async () => {
    await limpiarBadge();
    expect(Notifications.setBadgeCountAsync).toHaveBeenCalledWith(0);
  });
});
