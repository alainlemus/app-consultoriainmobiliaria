import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography, Radius } from '../../src/theme';
import { createExpediente } from '../../src/services/api';

export default function NuevoExpedienteScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { contacto_id, contacto_nombre } = useLocalSearchParams<{
    contacto_id:     string;
    contacto_nombre: string;
  }>();

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contacto_id) {
      setError('No se especificó un prospecto.');
      return;
    }

    createExpediente({
      contacto_id:     Number(contacto_id),
      tipo_tramite_id: 1,          // FOVISSSTE Crédito Tradicional (por defecto)
      estado:          'en_proceso' as any,
    })
      .then(exp => router.replace(`/expedientes/${exp.id}`))
      .catch(e => setError(e instanceof Error ? e.message : 'Error al crear el expediente'));
  }, []);

  return (
    <View style={[styles.flex, { paddingTop: insets.top + Spacing.xl }]}>
      {error ? (
        <>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Volver</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color={Colors.gold[400]} />
          <Text style={styles.loadingText}>
            Iniciando expediente{contacto_nombre ? ` de ${contacto_nombre}` : ''}…
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex:        { flex: 1, backgroundColor: Colors.cream[50], alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  loadingText: { fontSize: Typography.fontSize.sm, color: Colors.dark[500], textAlign: 'center', paddingHorizontal: Spacing.xl },
  errorText:   { fontSize: Typography.fontSize.sm, color: Colors.crimson[600], textAlign: 'center', paddingHorizontal: Spacing.xl },
  backBtn:     { marginTop: Spacing.sm, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.cream[300] },
  backBtnText: { fontSize: Typography.fontSize.sm, color: Colors.dark[700], fontWeight: Typography.fontWeight.semibold },
});
