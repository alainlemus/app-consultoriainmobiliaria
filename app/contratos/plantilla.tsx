/**
 * Pantalla: Ver plantilla del contrato
 *
 * Genera una vista previa del Contrato de Prestación de Servicios con la
 * plantilla actualmente cacheada (texto sincronizado del backend, o el
 * snapshot por defecto si la app nunca sincronizó), con los datos del
 * cliente en blanco. Sirve para confirmar que el texto está actualizado
 * antes de registrar un contrato real.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import Header from '@/src/components/ui/Header';
import Button from '@/src/components/ui/Button';
import { Colors, Typography, Spacing } from '@/src/theme';
import { getContratoConfig, renderPrestacionServiciosHtml } from '@/src/contratos/prestacionServicios';

export default function VerPlantillaScreen() {
  const router = useRouter();
  const [generando, setGenerando] = useState(false);

  async function verPlantilla() {
    setGenerando(true);
    try {
      const config = await getContratoConfig();
      const html = renderPrestacionServiciosHtml({
        folio:          'EJEMPLO',
        acreditado:     '',
        curp:           '',
        rfc:            '',
        domAcreditado:  '',
        tipoTramite:    'Crédito',
      }, config);

      const { uri } = await Print.printToFileAsync({ html });
      await Print.printAsync({ uri });
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo generar la vista previa.');
    } finally {
      setGenerando(false);
    }
  }

  async function compartirPlantilla() {
    setGenerando(true);
    try {
      const config = await getContratoConfig();
      const html = renderPrestacionServiciosHtml({
        folio: 'EJEMPLO', acreditado: '', curp: '', rfc: '', domAcreditado: '', tipoTramite: 'Crédito',
      }, config);
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      }
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo compartir la vista previa.');
    } finally {
      setGenerando(false);
    }
  }

  return (
    <View style={styles.flex}>
      <Header title="Ver contrato" subtitle="Plantilla vigente" onBack={() => router.back()} />

      <View style={styles.body}>
        <Ionicons name="document-text-outline" size={56} color={Colors.gold[400]} />
        <Text style={styles.title}>Contrato de Prestación de Servicios</Text>
        <Text style={styles.subtitle}>
          Se genera con el texto más reciente sincronizado desde el sistema, con los
          datos del cliente en blanco — sirve para confirmar que la plantilla está al día.
        </Text>

        {generando ? (
          <ActivityIndicator color={Colors.gold[400]} style={{ marginTop: Spacing.xl }} />
        ) : (
          <View style={{ gap: Spacing.sm, marginTop: Spacing.xl, alignSelf: 'stretch' }}>
            <Button label="Ver plantilla" onPress={verPlantilla} fullWidth />
            <Button label="Compartir" onPress={compartirPlantilla} variant="outline" fullWidth />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.dark[900] },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing['2xl'] },
  title: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, color: Colors.cream[50], marginTop: Spacing.base, textAlign: 'center' },
  subtitle: { fontSize: Typography.fontSize.sm, color: Colors.dark[400], textAlign: 'center', marginTop: Spacing.sm, lineHeight: 20 },
});
