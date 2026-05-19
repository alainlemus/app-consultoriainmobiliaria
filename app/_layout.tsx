import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { iniciarSyncAutomatico, detenerSyncAutomatico } from '../src/services/offline';
import { registrarPushToken, registrarListeners, limpiarBadge } from '../src/services/notifications';
import { ONBOARDING_KEY } from './onboarding';

export default function RootLayout() {
  const router   = useRouter();
  const segments = useSegments();

  useEffect(() => {
    (async () => {
      const token        = await SecureStore.getItemAsync('auth_token');
      const onboardingOk = await SecureStore.getItemAsync(ONBOARDING_KEY);
      const inAuth       = segments[0] === '(auth)';
      const inOnboarding = segments[0] === 'onboarding';

      if (!token && !inAuth) {
        router.replace('/(auth)/login');
      } else if (token && inAuth) {
        // Usuario autenticado — mostrar onboarding si es la primera vez
        if (!onboardingOk) {
          router.replace('/onboarding');
        } else {
          router.replace('/(tabs)');
        }
      } else if (token && !inOnboarding && !onboardingOk) {
        // Sesión activa pero nunca vio el onboarding (actualización de app)
        router.replace('/onboarding');
      }
    })();
  }, [segments]);

  // Sync automático al recuperar conexión
  useEffect(() => {
    iniciarSyncAutomatico();
    return () => detenerSyncAutomatico();
  }, []);

  // Push notifications
  useEffect(() => {
    // Registrar token (solo en dispositivo físico con EAS projectId)
    SecureStore.getItemAsync('auth_token').then(token => {
      if (token) registrarPushToken().catch(() => {});
    });

    limpiarBadge();

    // Listeners: tap en notificación → navegar
    const cleanup = registrarListeners(
      (_notif) => {
        // foreground — no necesita acción extra (se muestra el alert)
      },
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
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)"  options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)"  options={{ headerShown: false }} />
        <Stack.Screen name="prospectos/[id]"                    options={{ headerShown: false }} />
        <Stack.Screen name="prospectos/nuevo"                   options={{ headerShown: false }} />
        <Stack.Screen name="expedientes/[id]"                   options={{ headerShown: false }} />
        <Stack.Screen name="expedientes/documentos/subir"       options={{ headerShown: false }} />
        <Stack.Screen name="mapa"                               options={{ headerShown: false }} />
        <Stack.Screen name="onboarding"                         options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="ayuda"                              options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
