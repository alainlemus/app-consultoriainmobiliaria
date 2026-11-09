/**
 * /a/{codigo} — la liga impresa en el QR, cuando abre la app ya instalada.
 *
 *  - Sin sesión: manda al registro del acreditado con el código precargado.
 *  - Con sesión de acreditado: su portal (ya tiene cuenta; el código no aplica).
 *  - Con sesión de asesor/gestor: su inicio.
 */
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Colors } from '../../src/theme';
import { getAcreditadoToken } from '../../src/services/acreditadoApi';
import { inicioStaffCacheado } from '../../src/utils/rolStaff';
import { codigoDesdeUrl } from '../../src/utils/ligaQr';

export default function LigaQrScreen() {
  const router = useRouter();
  const { codigo } = useLocalSearchParams<{ codigo?: string }>();

  useEffect(() => {
    (async () => {
      const limpio = codigoDesdeUrl(`/a/${codigo ?? ''}`);

      if (await SecureStore.getItemAsync('auth_token')) {
        router.replace(await inicioStaffCacheado());
        return;
      }
      if (await getAcreditadoToken()) {
        router.replace('/(acreditado)');
        return;
      }
      if (limpio) {
        router.replace({ pathname: '/(auth)/registro-acreditado', params: { codigo: limpio } });
      } else {
        router.replace('/(auth)/login');
      }
    })();
  }, [codigo]);   // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.flex}>
      <ActivityIndicator color={Colors.gold[400]} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.dark[900], alignItems: 'center', justifyContent: 'center' },
});
