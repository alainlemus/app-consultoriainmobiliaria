import React, { useState } from 'react';
import {
  ScrollView, View, Text, StyleSheet,
  KeyboardAvoidingView, Platform, TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography, Radius } from '../../src/theme';
import Input  from '../../src/components/ui/Input';
import { createContacto } from '../../src/services/api';

type EstadoP  = 'nuevo' | 'contactado' | 'precalificado' | 'en_tramite' | 'cerrado' | 'no_interesado';
type Servicio = 'FOVISSSTE' | 'INFONAVIT' | '';

const ESTADOS: { value: EstadoP; label: string }[] = [
  { value: 'nuevo',          label: 'Nuevo' },
  { value: 'contactado',     label: 'Contactado' },
  { value: 'precalificado',  label: 'Precalificado' },
  { value: 'en_tramite',     label: 'En trámite' },
  { value: 'cerrado',        label: 'Cerrado' },
  { value: 'no_interesado',  label: 'No interesado' },
];

export default function NuevoProspectoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [form, setForm] = useState({
    nombre:           '',   // nombre completo
    telefono:         '',
    email:            '',
    notas:            '',
    estado_prospecto: 'nuevo' as EstadoP,
    servicio:         '' as Servicio,
  });
  const [errors,  setErrors]  = useState<Partial<Record<keyof typeof form, string>>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function set(key: keyof typeof form) {
    return (val: string) => setForm(f => ({ ...f, [key]: val }));
  }

  function validate(): boolean {
    const e: Partial<Record<keyof typeof form, string>> = {};
    if (!form.nombre.trim())    e.nombre   = 'El nombre es requerido';
    if (!form.servicio)         e.servicio = 'Selecciona un tipo de servicio';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setLoading(true);
    try {
      await createContacto({
        nombre:           form.nombre.trim(),
        telefono:         form.telefono || undefined,
        email:            form.email    || undefined,
        notas:            form.notas    || undefined,
        estado_prospecto: form.estado_prospecto,
        servicio:         form.servicio || undefined,
      });
      setSuccess(true);
      // Vuelve a la lista pasando parámetro para forzar refresh
      setTimeout(() => router.replace({ pathname: '/(tabs)/prospectos', params: { refresh: Date.now() } }), 900);
    } catch (e: unknown) {
      setErrors({ nombre: e instanceof Error ? e.message : 'Error al guardar.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: Colors.cream[50] }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header minimalista */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Nuevo prospecto</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {success && (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>✓  Prospecto guardado</Text>
          </View>
        )}

        {/* Nombre completo */}
        <Text style={styles.sectionLabel}>Datos personales</Text>
        <View style={styles.section}>
          <Input
            label="Nombre completo *"
            value={form.nombre}
            onChangeText={set('nombre')}
            error={errors.nombre}
            placeholder="Ej. Juan Pérez García"
            autoCapitalize="words"
          />
          <Input
            label="Teléfono"
            value={form.telefono}
            onChangeText={set('telefono')}
            keyboardType="phone-pad"
            placeholder="55 1234 5678"
          />
          <Input
            label="Correo electrónico"
            value={form.email}
            onChangeText={set('email')}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="correo@ejemplo.com"
          />
        </View>

        {/* Tipo de servicio */}
        <Text style={styles.sectionLabel}>Tipo de servicio *</Text>
        <View style={styles.section}>
          {errors.servicio ? <Text style={styles.fieldError}>{errors.servicio}</Text> : null}
          <View style={styles.servicioRow}>
            {(['FOVISSSTE', 'INFONAVIT'] as Servicio[]).map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.servicioBtn, form.servicio === s && styles.servicioBtnActive]}
                onPress={() => setForm(f => ({ ...f, servicio: s }))}
                activeOpacity={0.8}
              >
                <Text style={[styles.servicioBtnText, form.servicio === s && styles.servicioBtnTextActive]}>
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Estado */}
        <Text style={styles.sectionLabel}>Estado del prospecto</Text>
        <View style={styles.section}>
          <View style={styles.estadoGrid}>
            {ESTADOS.map(e => (
              <TouchableOpacity
                key={e.value}
                style={[styles.estadoChip, form.estado_prospecto === e.value && styles.estadoChipActive]}
                onPress={() => setForm(f => ({ ...f, estado_prospecto: e.value }))}
                activeOpacity={0.8}
              >
                <Text style={[styles.estadoChipText, form.estado_prospecto === e.value && styles.estadoChipTextActive]}>
                  {e.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notas */}
        <Text style={styles.sectionLabel}>Notas</Text>
        <View style={styles.section}>
          <Input
            value={form.notas}
            onChangeText={set('notas')}
            multiline
            numberOfLines={3}
            placeholder="Información adicional sobre el prospecto…"
          />
        </View>

        {/* Botón guardar */}
        <TouchableOpacity
          style={[styles.saveBtn, loading && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={styles.saveBtnText}>{loading ? 'Guardando…' : 'Guardar prospecto'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  topBar: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: Spacing.base,
    paddingBottom:   Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cream[300],
  },
  backBtn:  { width: 40, height: 40, justifyContent: 'center' },
  backIcon: { fontSize: 22, color: Colors.dark[700] },
  topTitle: { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[900] },

  body: { padding: Spacing.base },

  sectionLabel: {
    fontSize:      Typography.fontSize.xs,
    fontWeight:    Typography.fontWeight.semibold,
    color:         Colors.dark[500],
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop:     Spacing.base,
    marginBottom:  Spacing.sm,
  },

  section: {
    backgroundColor: Colors.white,
    borderRadius:    Radius.md,
    padding:         Spacing.base,
    borderWidth:     1,
    borderColor:     Colors.cream[300],
  },

  fieldError: {
    fontSize:     Typography.fontSize.xs,
    color:        Colors.error,
    marginBottom: Spacing.sm,
  },

  servicioRow: { flexDirection: 'row', gap: Spacing.sm },
  servicioBtn: {
    flex:            1,
    paddingVertical: Spacing.md,
    borderRadius:    Radius.md,
    borderWidth:     1.5,
    borderColor:     Colors.cream[300],
    alignItems:      'center',
    backgroundColor: Colors.cream[50],
  },
  servicioBtnActive: {
    borderColor:     Colors.gold[400],
    backgroundColor: Colors.gold[50],
  },
  servicioBtnText: {
    fontSize:   Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color:      Colors.dark[500],
  },
  servicioBtnTextActive: {
    color: Colors.gold[600],
  },

  estadoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  estadoChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical:   6,
    borderRadius:      Radius.full,
    borderWidth:       1,
    borderColor:       Colors.cream[300],
    backgroundColor:   Colors.cream[50],
  },
  estadoChipActive: {
    borderColor:     Colors.dark[800],
    backgroundColor: Colors.dark[800],
  },
  estadoChipText: {
    fontSize:   Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
    color:      Colors.dark[500],
  },
  estadoChipTextActive: {
    color: Colors.white,
  },

  saveBtn: {
    marginTop:       Spacing.xl,
    backgroundColor: Colors.dark[900],
    borderRadius:    Radius.md,
    paddingVertical: Spacing.base,
    alignItems:      'center',
  },
  saveBtnText: {
    color:      Colors.white,
    fontSize:   Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    letterSpacing: 0.5,
  },

  successBanner: {
    backgroundColor: '#f0fdf4',
    borderWidth:     1,
    borderColor:     '#bbf7d0',
    borderRadius:    Radius.md,
    padding:         Spacing.md,
    marginBottom:    Spacing.base,
    alignItems:      'center',
  },
  successText: { color: '#15803d', fontWeight: Typography.fontWeight.semibold, fontSize: Typography.fontSize.sm },
});
