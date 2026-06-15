import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { SyncProvider } from '../src/contexts/SyncContext';
import { AuthProvider } from '../src/contexts/AuthContext';
import { registrarPushToken, registrarListeners, limpiarBadge } from '../src/services/notifications';

export default function RootLayout() {
  const router   = useRouter();
  const segments = useSegments();

  useEffect(() => {
    (async () => {
      const token  = await SecureStore.getItemAsync('auth_token');
      const inAuth = segments[0] === '(auth)';

      if (!token && !inAuth) {
        router.replace('/(auth)/login');
      } else if (token && inAuth) {
        router.replace('/(tabs)');
      }
    })();
  }, [segments]);

  // Sync automático: manejado por SyncContext (SyncProvider en el árbol)
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
        <Stack.Screen name="(auth)"                               options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)"                               options={{ headerShown: false }} />
        <Stack.Screen name="prospectos/[id]"                      options={{ headerShown: false }} />
        <Stack.Screen name="prospectos/nuevo"                     options={{ headerShown: false }} />
        <Stack.Screen name="expedientes/[id]"                     options={{ headerShown: false }} />
        <Stack.Screen name="expedientes/documentos/subir"         options={{ headerShown: false }} />
        <Stack.Screen name="mapa"                                  options={{ headerShown: false }} />
        <Stack.Screen name="ayuda"                                  options={{ headerShown: false }} />
        <Stack.Screen name="anuncio/nuevo"                         options={{ headerShown: false }} />
      </Stack>
      </SyncProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
