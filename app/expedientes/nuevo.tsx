import React, { useState } from 'react';
import {
  ScrollView, View, Text, StyleSheet,
  KeyboardAvoidingView, Platform, TouchableOpacity, TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography, Radius } from '../../src/theme';
import { createExpediente } from '../../src/services/api';

// Tipos de trámite fijos (coinciden con BD)
const TIPOS_TRAMITE = [
  { id: 1, label: 'Crédito Tradicional FOVISSSTE' },
  { id: 2, label: 'Crédito Pensionados FOVISSSTE' },
  { id: 3, label: 'Crédito Conyugal FOVISSSTE' },
  { id: 7, label: 'FOVISSSTE-INFONAVIT Individual' },
  { id: 8, label: 'FOVISSSTE Para Todos (Bancos)' },
  { id: 9, label: 'ConstruYes (Construcción FOVISSSTE)' },
  { id: 4, label: 'Avalúo Comercial' },
  { id: 5, label: 'Gestión de Escrituras' },
  { id: 6, label: 'Asesoría Personalizada' },
];

const ESTADOS = [
  { value: 'en_proceso',     label: 'En proceso' },
  { value: 'documentacion',  label: 'Documentación' },
  { value: 'autorizado',     label: 'Autorizado' },
  { value: 'escrituracion',  label: 'Escrituración' },
];

export default function NuevoExpedienteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { contacto_id, contacto_nombre } = useLocalSearchParams<{
    contacto_id: string;
    contacto_nombre: string;
  }>();

  const [tipoId,  setTipoId]  = useState<number | null>(null);
  const [estado,  setEstado]  = useState('en_proceso');
  const [monto,   setMonto]   = useState('');
  const [notas,   setNotas]   = useState('');
  const [loading, setLoading] = useState(false);
  const [errors,  setErrors]  = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!tipoId) e.tipo = 'Selecciona el tipo de trámite';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleGuardar() {
    if (!validate()) return;
    setLoading(true);
    try {
      const exp = await createExpediente({
        contacto_id:     Number(contacto_id),
        tipo_tramite_id: tipoId!,
        estado:          estado as any,
        monto_credito:   monto ? Number(monto) : undefined,
        notas_internas:  notas || undefined,
      });
      setSuccess(true);
      setTimeout(() => {
        router.replace(`/expedientes/${exp.id}`);
      }, 800);
    } catch (e: unknown) {
      setErrors({ tipo: e instanceof Error ? e.message : 'Error al crear expediente' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: Colors.cream[50] }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Nuevo expediente</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {success && (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>✓  Expediente creado</Text>
          </View>
        )}

        {/* Prospecto */}
        <Text style={styles.sectionLabel}>Prospecto</Text>
        <View style={styles.section}>
          <View style={styles.prospectoRow}>
            <Text style={styles.prospectoIcon}>👤</Text>
            <Text style={styles.prospectoNombre}>{contacto_nombre ?? `ID ${contacto_id}`}</Text>
          </View>
        </View>

        {/* Tipo de trámite */}
        <Text style={styles.sectionLabel}>Tipo de trámite *</Text>
        {errors.tipo ? <Text style={styles.fieldError}>{errors.tipo}</Text> : null}
        <View style={styles.section}>
          {TIPOS_TRAMITE.map(t => (
            <TouchableOpacity
              key={t.id}
              style={[styles.tipoRow, tipoId === t.id && styles.tipoRowActive]}
              onPress={() => setTipoId(t.id)}
              activeOpacity={0.75}
            >
              <View style={[styles.radio, tipoId === t.id && styles.radioActive]} />
              <Text style={[styles.tipoLabel, tipoId === t.id && styles.tipoLabelActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Estado inicial */}
        <Text style={styles.sectionLabel}>Estado inicial</Text>
        <View style={styles.section}>
          <View style={styles.estadoGrid}>
            {ESTADOS.map(e => (
              <TouchableOpacity
                key={e.value}
                style={[styles.chip, estado === e.value && styles.chipActive]}
                onPress={() => setEstado(e.value)}
              >
                <Text style={[styles.chipText, estado === e.value && styles.chipTextActive]}>
                  {e.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Monto (opcional) */}
        <Text style={styles.sectionLabel}>Monto del crédito (opcional)</Text>
        <View style={styles.section}>
          <TextInput
            style={styles.input}
            value={monto}
            onChangeText={setMonto}
            keyboardType="numeric"
            placeholder="Ej. 1350000"
            placeholderTextColor={Colors.dark[400]}
          />
        </View>

        {/* Notas */}
        <Text style={styles.sectionLabel}>Notas internas (opcional)</Text>
        <View style={styles.section}>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={notas}
            onChangeText={setNotas}
            multiline
            numberOfLines={3}
            placeholder="Observaciones internas del expediente…"
            placeholderTextColor={Colors.dark[400]}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, loading && { opacity: 0.6 }]}
          onPress={handleGuardar}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={styles.saveBtnText}>
            {loading ? 'Creando expediente…' : 'Iniciar expediente'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingBottom: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.cream[300],
  },
  backBtn:  { width: 40, height: 40, justifyContent: 'center' },
  backIcon: { fontSize: 22, color: Colors.dark[700] },
  topTitle: { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[900] },

  body: { padding: Spacing.base },

  sectionLabel: {
    fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.semibold,
    color: Colors.dark[500], letterSpacing: 1, textTransform: 'uppercase',
    marginTop: Spacing.base, marginBottom: Spacing.sm,
  },

  section: {
    backgroundColor: Colors.white, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.cream[300], overflow: 'hidden',
  },

  fieldError: { fontSize: Typography.fontSize.xs, color: Colors.error, marginBottom: Spacing.xs },

  prospectoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  prospectoIcon: { fontSize: 20 },
  prospectoNombre: { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[900] },

  tipoRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.cream[100],
  },
  tipoRowActive: { backgroundColor: Colors.gold[50] },
  radio:         { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: Colors.cream[300] },
  radioActive:   { borderColor: Colors.gold[500], backgroundColor: Colors.gold[400] },
  tipoLabel:     { fontSize: Typography.fontSize.sm, color: Colors.dark[700], flex: 1 },
  tipoLabelActive: { color: Colors.gold[700], fontWeight: Typography.fontWeight.semibold },

  estadoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, padding: Spacing.md },
  chip: {
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.cream[300], backgroundColor: Colors.cream[50],
  },
  chipActive: { backgroundColor: Colors.dark[800], borderColor: Colors.dark[800] },
  chipText:   { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[500] },
  chipTextActive: { color: Colors.white },

  input: {
    fontSize: Typography.fontSize.sm, color: Colors.dark[900],
    padding: Spacing.md,
  },
  inputMulti: { minHeight: 80 },

  saveBtn: {
    marginTop: Spacing.xl, backgroundColor: Colors.dark[900],
    borderRadius: Radius.md, paddingVertical: Spacing.base, alignItems: 'center',
  },
  saveBtnText: {
    color: Colors.white, fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold, letterSpacing: 0.5,
  },

  successBanner: {
    backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0',
    borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.base, alignItems: 'center',
  },
  successText: { color: '#15803d', fontWeight: Typography.fontWeight.semibold, fontSize: Typography.fontSize.sm },
});
