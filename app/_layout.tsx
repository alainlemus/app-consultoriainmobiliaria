import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { SyncProvider } from '../src/contexts/SyncContext';
import { AuthProvider } from '../src/contexts/AuthContext';
import { registrarPushToken, registrarPushTokenAcreditado, registrarListeners, limpiarBadge, obtenerNotificacionInicial } from '../src/services/notifications';
import { rutaParaNotificacion, esInicio, type DatosNotificacion } from '../src/utils/rutaNotificacion';
import { getAcreditadoToken, removeAcreditadoToken } from '../src/services/acreditadoApi';

export default function RootLayout() {
  const router = useRouter();

  // Si la app estaba cerrada y se abrió tocando una notificación, ir a su pantalla
  // (después de la redirección al home, para que "atrás" regrese a él).
  async function abrirNotificacionInicial(esAcreditado: boolean) {
    const inicial = await obtenerNotificacionInicial();
    if (!inicial) return;
    const ruta = rutaParaNotificacion(inicial.data as DatosNotificacion, esAcreditado);
    if (!esInicio(ruta)) setTimeout(() => router.push(ruta as never), 300); // el inicio ya está abierto
  }

  // ── Redirección inicial — solo se ejecuta UNA vez al montar ────────────────
  // No depender de `segments` evita que cambios de ruta internos (ej. navegar
  // de /(tabs) a /expedientes/123) vuelvan a evaluar esta lógica y redirijan
  // erróneamente al acreditado si existe un token residual de sesión anterior.
  useEffect(() => {
    (async () => {
      const asesorToken     = await SecureStore.getItemAsync('auth_token');
      const acreditadoToken = await getAcreditadoToken();

      // ── Caso especial: ambos tokens presentes ─────────────────────────────
      // El asesor siempre tiene prioridad. Limpiamos el token de acreditado
      // huérfano y mandamos al asesor a su home.
      if (asesorToken && acreditadoToken) {
        await removeAcreditadoToken();
        router.replace('/(tabs)');
        await abrirNotificacionInicial(false);
        return;
      }

      // ── Asesor con token → su home ────────────────────────────────────────
      if (asesorToken) {
        router.replace('/(tabs)');
        await abrirNotificacionInicial(false);
        return;
      }

      // ── Acreditado con token → su portal ──────────────────────────────────
      if (acreditadoToken) {
        router.replace('/(acreditado)');
        await abrirNotificacionInicial(true);
        return;
      }

      // ── Sin sesión → login ────────────────────────────────────────────────
      router.replace('/(auth)/login');
    })();
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // Push notifications
  useEffect(() => {
    SecureStore.getItemAsync('auth_token').then(token => {
      if (token) registrarPushToken().catch(() => {});
    });
    getAcreditadoToken().then(token => {
      if (token) registrarPushTokenAcreditado().catch(() => {});
    });

    limpiarBadge();

    const cleanup = registrarListeners(
      (_notif) => {},
      async (response) => {
        const data = response.notification.request.content.data as DatosNotificacion;
        // Si hay sesión de asesor manda sobre una de acreditado residual (igual que al iniciar)
        const esAcreditado = !(await SecureStore.getItemAsync('auth_token')) && !!(await getAcreditadoToken());
        const ruta = rutaParaNotificacion(data, esAcreditado);
        if (esInicio(ruta)) router.navigate(ruta as never);
        else router.push(ruta as never);
      },
    );

    return cleanup;
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
      <SyncProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)"                           options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)"                           options={{ headerShown: false }} />
        <Stack.Screen name="(acreditado)"                     options={{ headerShown: false }} />
        <Stack.Screen name="prospectos/[id]"                  options={{ headerShown: false }} />
        <Stack.Screen name="prospectos/nuevo"                 options={{ headerShown: false }} />
        <Stack.Screen name="expedientes/[id]"                 options={{ headerShown: false }} />
        <Stack.Screen name="expedientes/subir-documento"        options={{ headerShown: false }} />
        <Stack.Screen name="subir-documento-acreditado"         options={{ headerShown: false }} />
        <Stack.Screen name="mapa"                             options={{ headerShown: false }} />
        <Stack.Screen name="ayuda"                            options={{ headerShown: false }} />
        <Stack.Screen name="ayuda-acreditado"                 options={{ headerShown: false }} />
        <Stack.Screen name="anuncio/nuevo"                    options={{ headerShown: false }} />
      </Stack>
      </SyncProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
