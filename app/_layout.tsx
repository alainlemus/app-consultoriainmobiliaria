import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { SyncProvider } from '../src/contexts/SyncContext';
import { AuthProvider } from '../src/contexts/AuthContext';
import { registrarPushToken, registrarListeners, limpiarBadge } from '../src/services/notifications';
import { getAcreditadoToken } from '../src/services/acreditadoApi';

export default function RootLayout() {
  const router   = useRouter();
  const segments = useSegments();

  // Guard de autenticación — solo al montar la app (sin [segments] en deps)
  // Decide el flujo inicial: login, tabs del asesor o tabs del acreditado.
  // Una vez que el usuario está navegando no volvemos a interrumpirlo.
  useEffect(() => {
    (async () => {
      const asesorToken     = await SecureStore.getItemAsync('auth_token');
      const acreditadoToken = await getAcreditadoToken();
      const inAuth          = segments[0] === '(auth)';

      // Ya está en auth → no hacer nada
      if (inAuth) return;

      // Acreditado con sesión → su sección
      if (acreditadoToken && segments[0] !== '(acreditado)') {
        router.replace('/(acreditado)');
        return;
      }

      // Sin ninguna sesión → login
      if (!asesorToken && !acreditadoToken) {
        router.replace('/(auth)/login');
      }
      // Asesor con sesión → puede navegar libremente, no redirigimos
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Solo al montar — sin segments en dependencias

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
