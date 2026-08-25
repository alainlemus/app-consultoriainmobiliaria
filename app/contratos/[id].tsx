/**
 * Pantalla: Ver contrato generado (historial)
 * Ruta: /contratos/[id] — id local del registro en contratosGenerados.ts
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import Header from '@/src/components/ui/Header';
import Button from '@/src/components/ui/Button';
import { Colors, Typography, Spacing } from '@/src/theme';
import { getContratoGenerado, eliminarContratoGenerado, type ContratoGenerado } from '@/src/services/contratosGenerados';

export default function VerContratoGeneradoScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [contrato, setContrato] = useState<ContratoGenerado | null>(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    (async () => {
      const c = await getContratoGenerado(id);
      setContrato(c);
      setLoading(false);
    })();
  }, [id]);

  async function verPdf() {
    if (!contrato) return;
    try { await Print.printAsync({ uri: contrato.fileUri }); } catch { /* usuario canceló */ }
  }

  async function compartirPdf() {
    if (!contrato) return;
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(contrato.fileUri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      }
    } catch { /* usuario canceló */ }
  }

  function eliminar() {
    if (!contrato) return;
    Alert.alert('Eliminar contrato', '¿Quitar este contrato del historial? El PDF se borrará del dispositivo.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          await eliminarContratoGenerado(contrato.id);
          router.back();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={[s.flex, s.centered]}>
        <ActivityIndicator color={Colors.gold[400]} size="large" />
      </View>
    );
  }

  if (!contrato) {
    return (
      <View style={s.flex}>
        <Header title="Contrato" onBack={() => router.back()} />
        <View style={[s.flex, s.centered]}>
          <Text style={s.subtitle}>No se encontró este contrato.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.flex}>
      <Header title="Contrato" subtitle={contrato.folio ?? undefined} onBack={() => router.back()} />
      <View style={s.body}>
        <Ionicons name="document-text" size={56} color={Colors.gold[400]} />
        <Text style={s.title}>{contrato.clienteNombre}</Text>
        <Text style={s.subtitle}>
          {contrato.folio ?? (contrato.expedienteId ? `Exp. #${contrato.expedienteId}` : 'Sin folio')} · Generado el {new Date(contrato.createdAt).toLocaleDateString('es-MX')}
        </Text>

        <View style={{ gap: Spacing.sm, marginTop: Spacing.xl, alignSelf: 'stretch' }}>
          <Button label="Ver / Imprimir" onPress={verPdf} fullWidth />
          <Button label="Compartir" onPress={compartirPdf} variant="outline" fullWidth />
          <Button label="Eliminar" onPress={eliminar} variant="danger" fullWidth />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.dark[900] },
  centered: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing['2xl'] },
  title: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, color: Colors.cream[50], marginTop: Spacing.base, textAlign: 'center' },
  subtitle: { fontSize: Typography.fontSize.sm, color: Colors.dark[400], textAlign: 'center', marginTop: Spacing.sm },
});
