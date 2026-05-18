import React, { useEffect, useState } from 'react';
import {
  ScrollView, View, Text, StyleSheet,
  TouchableOpacity, ActivityIndicator, TextInput,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '../../src/theme';
import Badge, { ESTADO_PROSPECTO_BADGE } from '../../src/components/ui/Badge';
import { getContacto, updateContacto } from '../../src/services/api';
import type { Contacto, EstadoProspecto } from '../../src/types';

type Servicio = 'FOVISSSTE' | 'INFONAVIT' | '';

const ESTADOS: { value: EstadoProspecto; label: string }[] = [
  { value: 'nuevo',         label: 'Nuevo' },
  { value: 'contactado',    label: 'Contactado' },
  { value: 'precalificado', label: 'Precalificado' },
  { value: 'en_tramite',    label: 'En trámite' },
  { value: 'cerrado',       label: 'Cerrado' },
  { value: 'no_interesado', label: 'No interesado' },
];

export default function DetalleProspectoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [contacto,  setContacto]  = useState<Contacto | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [editing,   setEditing]   = useState(false);
  const [saving,    setSaving]    = useState(false);

  // Campos del formulario de edición
  const [nombre,   setNombre]   = useState('');
  const [telefono, setTelefono] = useState('');
  const [email,    setEmail]    = useState('');
  const [notas,    setNotas]    = useState('');
  const [servicio, setServicio] = useState<Servicio>('');
  const [estado,   setEstado]   = useState<EstadoProspecto>('nuevo');

  useEffect(() => {
    if (!id) return;
    getContacto(Number(id))
      .then(c => {
        setContacto(c);
        // Pre-carga los campos de edición
        setNombre(c.nombre ?? '');
        setTelefono(c.telefono ?? '');
        setEmail(c.email ?? '');
        setNotas(c.notas ?? '');
        setServicio((c.servicio as Servicio) ?? '');
        setEstado(c.estado_prospecto);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave() {
    if (!nombre.trim()) {
      Alert.alert('Campo requerido', 'El nombre no puede estar vacío.');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateContacto(Number(id), {
        nombre:           nombre.trim(),
        telefono:         telefono || undefined,
        email:            email    || undefined,
        notas:            notas    || undefined,
        servicio:         servicio || undefined,
        estado_prospecto: estado,
      });
      setContacto(updated);
      setEditing(false);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    if (!contacto) return;
    setNombre(contacto.nombre ?? '');
    setTelefono(contacto.telefono ?? '');
    setEmail(contacto.email ?? '');
    setNotas(contacto.notas ?? '');
    setServicio((contacto.servicio as Servicio) ?? '');
    setEstado(contacto.estado_prospecto);
    setEditing(false);
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.flex}>
        <TopBar title="Cargando…" onBack={() => router.back()} insetTop={insets.top} />
        <View style={styles.center}>
          <ActivityIndicator color={Colors.gold[400]} size="large" />
        </View>
      </View>
    );
  }

  if (!contacto) {
    return (
      <View style={styles.flex}>
        <TopBar title="No encontrado" onBack={() => router.back()} insetTop={insets.top} />
        <Text style={styles.notFound}>No se encontró el prospecto.</Text>
      </View>
    );
  }

  // ── Vista detalle ────────────────────────────────────────────────────────
  if (!editing) {
    return (
      <View style={styles.flex}>
        <TopBar
          title={contacto.nombre}
          subtitle="Prospecto"
          onBack={() => router.back()}
          insetTop={insets.top}
          rightElement={
            <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
              <Text style={styles.editBtnText}>Editar</Text>
            </TouchableOpacity>
          }
        />

        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Badge estado */}
          <View style={styles.badgeRow}>
            <Badge
              label={contacto.estado_prospecto}
              variant={ESTADO_PROSPECTO_BADGE[contacto.estado_prospecto] ?? 'gray'}
            />
            {contacto.servicio ? (
              <View style={styles.servicioPill}>
                <Text style={styles.servicioPillText}>{contacto.servicio}</Text>
              </View>
            ) : null}
          </View>

          <SectionLabel>Datos personales</SectionLabel>
          <Card>
            <InfoRow label="Nombre"    value={contacto.nombre ?? '—'} />
            <InfoRow label="Teléfono"  value={contacto.telefono ?? '—'} />
            <InfoRow label="Correo"    value={contacto.email ?? '—'} />
            <InfoRow label="Servicio"  value={contacto.servicio ?? '—'} last />
          </Card>

          {contacto.notas ? (
            <>
              <SectionLabel>Notas</SectionLabel>
              <Card>
                <Text style={styles.notasText}>{contacto.notas}</Text>
              </Card>
            </>
          ) : null}

          <SectionLabel>Fechas</SectionLabel>
          <Card>
            <InfoRow label="Registrado"   value={fmt(contacto.created_at)} />
            <InfoRow label="Actualizado"  value={fmt(contacto.updated_at)} last />
          </Card>

          {/* Acciones rápidas */}
          <SectionLabel>Acciones</SectionLabel>
          <View style={styles.actionsCard}>
            <ActionRow
              icon="📁"
              label="Iniciar expediente"
              onPress={() => router.push({
                pathname: '/expedientes/nuevo',
                params: { contacto_id: String(contacto.id), contacto_nombre: contacto.nombre },
              })}
            />
            <ActionRow icon="📍" label="Registrar visita"   onPress={() => router.push('/mapa')} border />
            <ActionRow icon="✏️" label="Editar prospecto"   onPress={() => setEditing(true)} />
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Formulario edición ───────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TopBar
        title="Editar prospecto"
        onBack={handleCancelEdit}
        insetTop={insets.top}
        rightElement={
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Guardando…' : 'Guardar'}</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SectionLabel>Datos personales</SectionLabel>
        <View style={styles.formCard}>
          <FormField label="Nombre completo *">
            <TextInput
              style={styles.input}
              value={nombre}
              onChangeText={setNombre}
              autoCapitalize="words"
              placeholder="Nombre completo"
              placeholderTextColor={Colors.dark[400]}
            />
          </FormField>
          <FormField label="Teléfono" border>
            <TextInput
              style={styles.input}
              value={telefono}
              onChangeText={setTelefono}
              keyboardType="phone-pad"
              placeholder="55 1234 5678"
              placeholderTextColor={Colors.dark[400]}
            />
          </FormField>
          <FormField label="Correo electrónico" border last>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="correo@ejemplo.com"
              placeholderTextColor={Colors.dark[400]}
            />
          </FormField>
        </View>

        <SectionLabel>Tipo de servicio</SectionLabel>
        <View style={styles.formCard}>
          <View style={styles.servicioRow}>
            {(['FOVISSSTE', 'INFONAVIT'] as Servicio[]).map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.servicioBtn, servicio === s && styles.servicioBtnActive]}
                onPress={() => setServicio(s)}
              >
                <Text style={[styles.servicioBtnText, servicio === s && styles.servicioBtnTextActive]}>
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <SectionLabel>Estado del prospecto</SectionLabel>
        <View style={styles.formCard}>
          <View style={styles.estadoGrid}>
            {ESTADOS.map(e => (
              <TouchableOpacity
                key={e.value}
                style={[styles.estadoChip, estado === e.value && styles.estadoChipActive]}
                onPress={() => setEstado(e.value)}
              >
                <Text style={[styles.estadoChipText, estado === e.value && styles.estadoChipTextActive]}>
                  {e.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <SectionLabel>Notas</SectionLabel>
        <View style={styles.formCard}>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={notas}
            onChangeText={setNotas}
            multiline
            numberOfLines={4}
            placeholder="Observaciones sobre el prospecto…"
            placeholderTextColor={Colors.dark[400]}
            textAlignVertical="top"
          />
        </View>

        {/* Botón guardar al fondo */}
        <TouchableOpacity
          style={[styles.saveBtnLarge, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          <Text style={styles.saveBtnLargeText}>{saving ? 'Guardando…' : 'Guardar cambios'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelEdit}>
          <Text style={styles.cancelBtnText}>Cancelar</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function TopBar({ title, subtitle, onBack, insetTop, rightElement }: {
  title: string; subtitle?: string; onBack: () => void;
  insetTop: number; rightElement?: React.ReactNode;
}) {
  return (
    <View style={[tb.wrap, { paddingTop: insetTop + 8 }]}>
      <TouchableOpacity style={tb.back} onPress={onBack}>
        <Text style={tb.backIcon}>←</Text>
      </TouchableOpacity>
      <View style={tb.mid}>
        {subtitle ? <Text style={tb.sub}>{subtitle}</Text> : null}
        <Text style={tb.title} numberOfLines={1}>{title}</Text>
      </View>
      <View style={tb.right}>{rightElement ?? <View style={{ width: 60 }} />}</View>
    </View>
  );
}
const tb = StyleSheet.create({
  wrap:     { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, paddingHorizontal: Spacing.sm, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.cream[300] },
  back:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 22, color: Colors.dark[700] },
  mid:      { flex: 1, alignItems: 'center' },
  sub:      { fontSize: 10, color: Colors.dark[400], letterSpacing: 1, textTransform: 'uppercase' },
  title:    { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[900] },
  right:    { minWidth: 60, alignItems: 'flex-end' },
});

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function ActionRow({ icon, label, onPress, border }: { icon: string; label: string; onPress: () => void; border?: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.actionRow, border && styles.actionRowBorder]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={styles.actionIcon}>{icon}</Text>
      <Text style={styles.actionLabel}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

function FormField({ label, children, border, last }: { label: string; children: React.ReactNode; border?: boolean; last?: boolean }) {
  return (
    <View style={[styles.formField, border && styles.formFieldBorder]}>
      <Text style={styles.formLabel}>{label}</Text>
      {children}
    </View>
  );
}

// ── Estilos ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex:     { flex: 1, backgroundColor: Colors.cream[50] },
  center:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { textAlign: 'center', color: Colors.dark[400], marginTop: 40 },
  body:     { padding: Spacing.base },

  editBtn:     { borderWidth: 1, borderColor: Colors.dark[700], borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 5 },
  editBtnText: { color: Colors.dark[700], fontWeight: Typography.fontWeight.semibold, fontSize: Typography.fontSize.xs },
  saveBtn:     { backgroundColor: Colors.dark[900], borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  saveBtnText: { color: Colors.gold[400], fontWeight: Typography.fontWeight.bold, fontSize: Typography.fontSize.xs },

  sectionLabel: {
    fontSize:      Typography.fontSize.xs,
    fontWeight:    Typography.fontWeight.bold,
    color:         Colors.dark[500],
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop:     Spacing.base,
    marginBottom:  Spacing.xs,
  },

  badgeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xs, marginTop: Spacing.xs },
  servicioPill: { backgroundColor: Colors.gold[50], borderWidth: 1, borderColor: Colors.gold[300], borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  servicioPillText: { fontSize: Typography.fontSize.xs, color: Colors.gold[600], fontWeight: Typography.fontWeight.bold },

  card: {
    backgroundColor: Colors.white,
    borderRadius:    Radius.md,
    borderWidth:     1,
    borderColor:     Colors.cream[200],
    overflow:        'hidden',
    marginBottom:    Spacing.xs,
  },

  infoRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.cream[200] },
  infoLabel:     { fontSize: Typography.fontSize.xs, color: Colors.dark[500], fontWeight: Typography.fontWeight.semibold, flex: 1 },
  infoValue:     { fontSize: Typography.fontSize.sm, color: Colors.dark[800], flex: 2, textAlign: 'right' },

  notasText: { fontSize: Typography.fontSize.sm, color: Colors.dark[700], lineHeight: 20, padding: Spacing.md },

  actionsCard: {
    backgroundColor: Colors.white,
    borderRadius:    Radius.md,
    borderWidth:     1,
    borderColor:     Colors.cream[200],
    overflow:        'hidden',
    marginBottom:    Spacing.xs,
  },
  actionRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.md, gap: Spacing.sm },
  actionRowBorder: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.cream[200] },
  actionIcon:      { fontSize: 18 },
  actionLabel:     { flex: 1, fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[800] },
  chevron:         { fontSize: 20, color: Colors.dark[300] },

  // Formulario
  formCard: {
    backgroundColor: Colors.white,
    borderRadius:    Radius.md,
    borderWidth:     1,
    borderColor:     Colors.cream[200],
    overflow:        'hidden',
    marginBottom:    Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  formField:       { paddingVertical: Spacing.sm },
  formFieldBorder: { borderTopWidth: 1, borderTopColor: Colors.cream[200] },
  formLabel:       { fontSize: Typography.fontSize.xs, color: Colors.dark[500], fontWeight: Typography.fontWeight.semibold, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    fontSize:   Typography.fontSize.sm,
    color:      Colors.dark[900],
    paddingVertical: Spacing.xs,
  },
  inputMultiline: {
    minHeight:  80,
    padding:    Spacing.md,
  },

  servicioRow: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: Spacing.sm },
  servicioBtn: {
    flex:            1,
    paddingVertical: Spacing.sm,
    borderRadius:    Radius.md,
    borderWidth:     1.5,
    borderColor:     Colors.cream[300],
    alignItems:      'center',
    backgroundColor: Colors.cream[50],
  },
  servicioBtnActive:    { borderColor: Colors.gold[400], backgroundColor: Colors.gold[50] },
  servicioBtnText:      { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.bold, color: Colors.dark[500] },
  servicioBtnTextActive:{ color: Colors.gold[600] },

  estadoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, paddingVertical: Spacing.sm },
  estadoChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical:   5,
    borderRadius:      Radius.full,
    borderWidth:       1,
    borderColor:       Colors.cream[300],
    backgroundColor:   Colors.cream[50],
  },
  estadoChipActive:     { borderColor: Colors.dark[800], backgroundColor: Colors.dark[800] },
  estadoChipText:       { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[500] },
  estadoChipTextActive: { color: Colors.white },

  saveBtnLarge: {
    marginTop:       Spacing.xl,
    backgroundColor: Colors.dark[900],
    borderRadius:    Radius.md,
    paddingVertical: Spacing.base,
    alignItems:      'center',
  },
  saveBtnLargeText: { color: Colors.white, fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold, letterSpacing: 0.5 },
  cancelBtn:        { marginTop: Spacing.sm, paddingVertical: Spacing.md, alignItems: 'center' },
  cancelBtnText:    { color: Colors.dark[400], fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold },
});
