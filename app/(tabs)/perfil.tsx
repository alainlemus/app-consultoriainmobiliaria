import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, Image,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '../../src/theme';
import Card from '../../src/components/ui/Card';
import { getMe, logout, updatePerfil, subirFotoPerfil } from '../../src/services/api';
import type { User } from '../../src/types';

export default function PerfilScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  const [user,      setUser]      = useState<User | null>(null);
  const [editando,  setEditando]  = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [subiendo,  setSubiendo]  = useState(false);

  // Campos editables
  const [nombre,   setNombre]   = useState('');
  const [telefono, setTelefono] = useState('');
  const [banco,    setBanco]    = useState('');
  const [clabe,    setClabe]    = useState('');

  const cargarUsuario = useCallback(async () => {
    try {
      const u = await getMe();
      setUser(u);
      setNombre(u?.name     ?? '');
      setTelefono(u?.telefono ?? '');
      setBanco(u?.banco     ?? '');
      setClabe(u?.clabe     ?? '');
    } catch {}
  }, []);

  useEffect(() => { cargarUsuario(); }, [cargarUsuario]);

  // ── Guardar cambios de texto ───────────────────────────────────────────────
  async function handleGuardar() {
    if (!nombre.trim()) {
      Alert.alert('Campo requerido', 'El nombre no puede estar vacío.');
      return;
    }
    setGuardando(true);
    try {
      const updated = await updatePerfil({
        name:     nombre.trim(),
        telefono: telefono.trim() || undefined,
        banco:    banco.trim()    || undefined,
        clabe:    clabe.trim()    || undefined,
      });
      setUser(updated);
      setEditando(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  function handleCancelar() {
    setNombre(user?.name     ?? '');
    setTelefono(user?.telefono ?? '');
    setBanco(user?.banco     ?? '');
    setClabe(user?.clabe     ?? '');
    setEditando(false);
  }

  // ── Tomar selfie ───────────────────────────────────────────────────────────
  async function handleSelfie() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara para tomar la foto.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      cameraType:         ImagePicker.CameraType.front,
      allowsEditing:      true,
      aspect:             [1, 1],
      quality:            0.7,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;

    setSubiendo(true);
    try {
      const nuevaUrl = await subirFotoPerfil(result.assets[0].uri);
      setUser(prev => prev ? { ...prev, foto_perfil_url: nuevaUrl } : prev);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo subir la foto.');
    } finally {
      setSubiendo(false);
    }
  }

  // ── Logout ─────────────────────────────────────────────────────────────────
  async function handleLogout() {
    await logout();
    router.replace('/(auth)/login');
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const inicial = user?.name?.[0]?.toUpperCase() ?? '?';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={s.bg}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header con avatar / foto ── */}
        <View style={[s.header, { paddingTop: insets.top + 16 }]}>
          <TouchableOpacity onPress={handleSelfie} style={s.avatarWrap} disabled={subiendo}>
            {subiendo ? (
              <View style={s.avatarCircle}>
                <ActivityIndicator color={Colors.gold[400]} />
              </View>
            ) : user?.foto_perfil_url ? (
              <Image source={{ uri: user.foto_perfil_url }} style={s.avatarImg} />
            ) : (
              <View style={s.avatarCircle}>
                <Text style={s.avatarLetter}>{inicial}</Text>
              </View>
            )}
            {/* Badge cámara */}
            <View style={s.cameraBadge}>
              <Text style={s.cameraBadgeText}>📷</Text>
            </View>
          </TouchableOpacity>

          <Text style={s.name}>{user?.name ?? '—'}</Text>
          <Text style={s.email}>{user?.email ?? '—'}</Text>
          {user?.roles?.map(r => (
            <View key={r} style={s.roleBadge}>
              <Text style={s.roleText}>{r.replace('_', ' ').toUpperCase()}</Text>
            </View>
          ))}
          <View style={s.goldLine} />
        </View>

        <View style={s.body}>
          {/* ── Información / Formulario ── */}
          <Card
            title="Información de cuenta"
            subtitle={editando ? 'Editando' : 'Perfil'}
            style={s.card}
          >
            {editando ? (
              <>
                <Field label="Nombre"   value={nombre}   onChangeText={setNombre}   placeholder="Tu nombre completo" />
                <Field label="Teléfono" value={telefono} onChangeText={setTelefono} placeholder="10 dígitos" keyboardType="phone-pad" />
                <Field label="Banco"    value={banco}    onChangeText={setBanco}    placeholder="Ej: BBVA, Banamex..." />
                <Field label="CLABE"    value={clabe}    onChangeText={setClabe}    placeholder="18 dígitos" keyboardType="number-pad" last />

                <View style={s.btnRow}>
                  <TouchableOpacity
                    style={[s.btn, s.btnCancelar]}
                    onPress={handleCancelar}
                    disabled={guardando}
                  >
                    <Text style={s.btnCancelarText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.btn, s.btnGuardar]}
                    onPress={handleGuardar}
                    disabled={guardando}
                  >
                    {guardando
                      ? <ActivityIndicator color={Colors.dark[900]} size="small" />
                      : <Text style={s.btnGuardarText}>Guardar</Text>
                    }
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <InfoRow label="Nombre"   value={user?.name     ?? '—'} />
                <InfoRow label="Correo"   value={user?.email    ?? '—'} />
                <InfoRow label="Teléfono" value={user?.telefono ?? '—'} />
                <InfoRow label="Banco"    value={user?.banco    ?? '—'} />
                <InfoRow label="CLABE"    value={user?.clabe    ?? '—'} last />

                <TouchableOpacity style={s.editBtn} onPress={() => setEditando(true)}>
                  <Text style={s.editBtnText}>Editar datos</Text>
                </TouchableOpacity>
              </>
            )}
          </Card>

          {/* ── Sesión ── */}
          <Card title="Sesión" subtitle="Cuenta" style={s.card}>
            <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
              <Text style={s.logoutText}>Cerrar sesión</Text>
            </TouchableOpacity>
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function InfoRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[s.infoRow, !last && s.infoRowBorder]}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

function Field({
  label, value, onChangeText, placeholder, keyboardType = 'default', last = false,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad' | 'number-pad';
  last?: boolean;
}) {
  return (
    <View style={[s.fieldWrap, !last && s.infoRowBorder]}>
      <Text style={s.infoLabel}>{label}</Text>
      <TextInput
        style={s.fieldInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.dark[400]}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'default' ? 'words' : 'none'}
      />
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  bg:   { flex: 1, backgroundColor: Colors.cream[50] },

  // Header
  header:       { backgroundColor: Colors.dark[900], alignItems: 'center', paddingHorizontal: Spacing.base, paddingBottom: Spacing.xl },
  avatarWrap:   { position: 'relative', marginBottom: Spacing.sm },
  avatarCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.dark[700], borderWidth: 3, borderColor: Colors.gold[400], alignItems: 'center', justifyContent: 'center' },
  avatarImg:    { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: Colors.gold[400] },
  avatarLetter: { color: Colors.gold[400], fontSize: Typography.fontSize['2xl'], fontWeight: Typography.fontWeight.black },
  cameraBadge:  { position: 'absolute', bottom: 0, right: -4, width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.gold[500], alignItems: 'center', justifyContent: 'center' },
  cameraBadgeText: { fontSize: 12 },
  name:         { fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.bold, color: Colors.cream[50] },
  email:        { fontSize: Typography.fontSize.sm, color: Colors.dark[400], marginTop: 2, marginBottom: Spacing.sm },
  roleBadge:    { paddingHorizontal: Spacing.md, paddingVertical: 2, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.gold[600], marginBottom: Spacing.sm },
  roleText:     { color: Colors.gold[400], fontSize: 10, fontWeight: Typography.fontWeight.bold, letterSpacing: 1 },
  goldLine:     { width: 32, height: 2, backgroundColor: Colors.gold[400], marginTop: Spacing.sm },

  // Body
  body: { padding: Spacing.base },
  card: { marginBottom: Spacing.base },

  // Rows
  infoRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.cream[200] },
  infoLabel:     { fontSize: Typography.fontSize.sm, color: Colors.dark[500], fontWeight: Typography.fontWeight.semibold, width: 80 },
  infoValue:     { fontSize: Typography.fontSize.sm, color: Colors.dark[800], flex: 1, textAlign: 'right' },

  // Field edit
  fieldWrap:  { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.xs },
  fieldInput: { flex: 1, textAlign: 'right', fontSize: Typography.fontSize.sm, color: Colors.dark[900], paddingVertical: 4, paddingHorizontal: Spacing.sm, backgroundColor: Colors.cream[100], borderRadius: Radius.sm },

  // Botones modo edición
  btnRow:         { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  btn:            { flex: 1, borderRadius: Radius.sm, paddingVertical: Spacing.sm, alignItems: 'center' },
  btnCancelar:    { backgroundColor: Colors.cream[200] },
  btnCancelarText:{ color: Colors.dark[700], fontWeight: Typography.fontWeight.semibold, fontSize: Typography.fontSize.sm },
  btnGuardar:     { backgroundColor: Colors.gold[400] },
  btnGuardarText: { color: Colors.dark[900], fontWeight: Typography.fontWeight.bold, fontSize: Typography.fontSize.sm },

  // Botón editar
  editBtn:     { marginTop: Spacing.md, borderWidth: 1, borderColor: Colors.gold[500], borderRadius: Radius.sm, paddingVertical: Spacing.sm, alignItems: 'center' },
  editBtnText: { color: Colors.gold[600], fontWeight: Typography.fontWeight.semibold, fontSize: Typography.fontSize.sm },

  // Logout
  logoutBtn:  { backgroundColor: Colors.crimson[600], borderRadius: Radius.sm, padding: Spacing.md, alignItems: 'center' },
  logoutText: { color: Colors.white, fontWeight: Typography.fontWeight.bold, fontSize: Typography.fontSize.sm, letterSpacing: Typography.letterSpacing.wider },
});
