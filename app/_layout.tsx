import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { SyncProvider } from '../src/contexts/SyncContext';
import { AuthProvider } from '../src/contexts/AuthContext';
import { registrarPushToken, registrarListeners, limpiarBadge } from '../src/services/notifications';
import { getAcreditadoToken, removeAcreditadoToken } from '../src/services/acreditadoApi';

export default function RootLayout() {
  const router = useRouter();

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
        return;
      }

      // ── Asesor con token → su home ────────────────────────────────────────
      if (asesorToken) {
        router.replace('/(tabs)');
        return;
      }

      // ── Acreditado con token → su portal ──────────────────────────────────
      if (acreditadoToken) {
        router.replace('/(acreditado)');
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

    limpiarBadge();

    const cleanup = registrarListeners(
      (_notif) => {},
      (response) => {
        const data = response.notification.request.content.data as {
          tipo?: string;
          expediente_id?: number;
          contacto_id?: number;
        };
        if (data?.expediente_id) {
          router.push(`/expedientes/${data.expediente_id}`);
        } else if (data?.contacto_id) {
          router.push(`/prospectos/${data.contacto_id}`);
        }
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
        <Stack.Screen name="expedientes/documentos/subir"     options={{ headerShown: false }} />
        <Stack.Screen name="mapa"                             options={{ headerShown: false }} />
        <Stack.Screen name="ayuda"                            options={{ headerShown: false }} />
        <Stack.Screen name="anuncio/nuevo"                    options={{ headerShown: false }} />
      </Stack>
      </SyncProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
