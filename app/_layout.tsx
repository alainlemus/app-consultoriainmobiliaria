import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { SyncProvider } from '../src/contexts/SyncContext';
import { AuthProvider } from '../src/contexts/AuthContext';
import { registrarPushToken, registrarListeners, limpiarBadge } from '../src/services/notifications';
import { getAcreditadoToken, removeAcreditadoToken } from '../src/services/acreditadoApi';

export default function RootLayout() {
  const router   = useRouter();
  const segments = useSegments();

  useEffect(() => {
    (async () => {
      const asesorToken     = await SecureStore.getItemAsync('auth_token');
      const acreditadoToken = await getAcreditadoToken();
      const inAuth          = segments[0] === '(auth)';

      // ── Caso especial: ambos tokens presentes ─────────────────────────────
      // El asesor tiene prioridad. Limpiamos el token de acreditado huérfano
      // para evitar estado inconsistente.
      if (asesorToken && acreditadoToken) {
        await removeAcreditadoToken();
        if (inAuth) router.replace('/(tabs)');
        return;
      }

      // ── Sin sesión → login ────────────────────────────────────────────────
      if (!asesorToken && !acreditadoToken && !inAuth) {
        router.replace('/(auth)/login');
        return;
      }

      // ── Asesor con token ──────────────────────────────────────────────────
      if (asesorToken && inAuth) {
        router.replace('/(tabs)');
        return;
      }

      // ── Acreditado con token ──────────────────────────────────────────────
      if (acreditadoToken && !asesorToken && inAuth) {
        router.replace('/(acreditado)');
        return;
      }

      if (acreditadoToken && !asesorToken && segments[0] !== '(acreditado)' && !inAuth) {
        router.replace('/(acreditado)');
        return;
      }
    })();
  }, [segments]);

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
