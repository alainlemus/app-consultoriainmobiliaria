import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../../../src/theme';
import {
  getMeAcreditado,
  updatePerfilAcreditado,
  cambiarPasswordAcreditado,
  solicitarCancelacionAcreditado,
  logoutAcreditado,
  subirFotoAcreditado,
} from '../../../src/services/acreditadoApi';
import { useAcreditadoAuth } from '../../../src/contexts/AcreditadoAuthContext';
import type { Acreditado } from '../../../src/types';

export default function PerfilAcreditadoScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { clearAcreditado } = useAcreditadoAuth();

  const [acreditado, setAcreditado] = useState<Acreditado | null>(null);
  const [editando,   setEditando]   = useState(false);
  const [guardando,  setGuardando]  = useState(false);
  const [loading,    setLoading]    = useState(true);

  // Campos editables
  const [name,     setName]     = useState('');
  const [telefono, setTelefono] = useState('');
  const [curp,     setCurp]     = useState('');
  const [nss,      setNss]      = useState('');

  // Cambiar contraseña
  const [showPassword,    setShowPassword]    = useState(false);
  const [pwActual,        setPwActual]        = useState('');
  const [pwNueva,         setPwNueva]         = useState('');
  const [pwConfirmacion,  setPwConfirmacion]  = useState('');
  const [cambiandoPw,     setCambiandoPw]     = useState(false);

  const cargar = useCallback(async () => {
    try {
      const a = await getMeAcreditado();
      setAcreditado(a);
      setName(a.name ?? '');
      setTelefono(a.telefono ?? '');
      setCurp(a.curp ?? '');
      setNss(a.nss ?? '');
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, []);

  async function handleGuardar() {
    if (!name.trim()) { Alert.alert('Error', 'El nombre no puede estar vacío.'); return; }
    setGuardando(true);
    try {
      const updated = await updatePerfilAcreditado({ name: name.trim(), telefono: telefono.trim() || undefined, curp: curp.trim().toUpperCase() || undefined, nss: nss.trim() || undefined });
      setAcreditado(updated);
      setEditando(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo guardar.');
    } finally { setGuardando(false); }
  }

  async function handleCambiarPassword() {
    if (!pwActual || !pwNueva || !pwConfirmacion) { Alert.alert('Error', 'Completa todos los campos.'); return; }
    if (pwNueva !== pwConfirmacion) { Alert.alert('Error', 'Las contraseñas no coinciden.'); return; }
    if (pwNueva.length < 8) { Alert.alert('Error', 'La contraseña debe tener al menos 8 caracteres.'); return; }
    setCambiandoPw(true);
    try {
      await cambiarPasswordAcreditado(pwActual, pwNueva, pwConfirmacion);
      setPwActual(''); setPwNueva(''); setPwConfirmacion('');
      setShowPassword(false);
      Alert.alert('✅ Contraseña actualizada', 'Tu contraseña fue cambiada correctamente.');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo cambiar la contraseña.');
    } finally { setCambiandoPw(false); }
  }

  async function handleSubirFoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permiso requerido', 'Activa el acceso a la galería.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.85 });
    if (result.canceled) return;
    try {
      await subirFotoAcreditado(result.assets[0].uri);
      await cargar();
    } catch {}
  }

  async function handleLogout() {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: async () => {
        await logoutAcreditado();
        clearAcreditado();
        router.replace('/(auth)/login');
      }},
    ]);
  }

  async function handleCancelacion() {
    Alert.alert(
      'Cancelar cuenta',
      'Esta acción desactivará tu cuenta. Tus datos serán eliminados según nuestra política de privacidad. ¿Continuar?',
      [
        { text: 'No', style: 'cancel' },
        { text: 'Sí, cancelar mi cuenta', style: 'destructive', onPress: async () => {
          try {
            await solicitarCancelacionAcreditado();
            clearAcreditado();
            Alert.alert('Cuenta desactivada', 'Tu solicitud fue recibida. Procesaremos la eliminación de tus datos.');
            router.replace('/(auth)/login');
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'No se pudo procesar tu solicitud.');
          }
        }},
      ]
    );
  }

  if (loading) {
    return (
      <View style={[styles.flex, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.gold[400]} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.base, paddingBottom: insets.bottom + Spacing['3xl'] }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header con foto */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleSubirFoto} style={styles.avatarBtn}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={40} color={Colors.dark[400]} />
            </View>
            <View style={styles.avatarEdit}>
              <Ionicons name="camera" size={12} color={Colors.dark[900]} />
            </View>
          </TouchableOpacity>
          <Text style={styles.userName}>{acreditado?.name ?? ''}</Text>
          <Text style={styles.userEmail}>{acreditado?.email ?? ''}</Text>
          {acreditado?.curp_verificado && (
            <View style={styles.verificadoBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#15803d" />
              <Text style={styles.verificadoText}>CURP verificado · Expediente vinculado</Text>
            </View>
          )}
        </View>

        {/* Datos del perfil */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionTitle}>MIS DATOS</Text>
            {!editando && (
              <TouchableOpacity onPress={() => setEditando(true)}>
                <Text style={styles.editLink}>Editar</Text>
              </TouchableOpacity>
            )}
          </View>

          {editando ? (
            <>
              {[
                { label: 'Nombre completo', value: name, onChange: setName, autoCapitalize: 'words' as const },
                { label: 'Teléfono', value: telefono, onChange: setTelefono, keyboardType: 'phone-pad' as const },
                { label: 'CURP', value: curp, onChange: (v: string) => setCurp(v.toUpperCase()), autoCapitalize: 'characters' as const, maxLength: 18 },
                { label: 'NSS', value: nss, onChange: setNss, keyboardType: 'numeric' as const, maxLength: 15 },
              ].map(f => (
                <View key={f.label} style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{f.label}</Text>
                  <TextInput
                    style={styles.input}
                    value={f.value}
                    onChangeText={f.onChange}
                    autoCapitalize={f.autoCapitalize}
                    keyboardType={f.keyboardType}
                    maxLength={f.maxLength}
                    placeholderTextColor={Colors.dark[500]}
                  />
                </View>
              ))}
              <View style={styles.editBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setEditando(false); cargar(); }}>
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleGuardar} disabled={guardando}>
                  {guardando ? <ActivityIndicator color={Colors.dark[900]} size="small" /> : <Text style={styles.saveBtnText}>Guardar</Text>}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            [
              { label: 'Nombre', value: acreditado?.name },
              { label: 'Teléfono', value: acreditado?.telefono },
              { label: 'CURP', value: acreditado?.curp },
              { label: 'NSS', value: acreditado?.nss },
              { label: 'RFC', value: acreditado?.rfc },
            ].filter(f => f.value).map(f => (
              <View key={f.label} style={styles.dataRow}>
                <Text style={styles.dataLabel}>{f.label}</Text>
                <Text style={styles.dataValue}>{f.value}</Text>
              </View>
            ))
          )}
        </View>

        {/* Cambiar contraseña */}
        <View style={styles.card}>
          <TouchableOpacity style={styles.cardHeaderRow} onPress={() => setShowPassword(v => !v)}>
            <Text style={styles.sectionTitle}>CONTRASEÑA</Text>
            <Ionicons name={showPassword ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.dark[400]} />
          </TouchableOpacity>

          {showPassword && (
            <>
              {[
                { label: 'Contraseña actual', value: pwActual, onChange: setPwActual },
                { label: 'Nueva contraseña', value: pwNueva, onChange: setPwNueva },
                { label: 'Confirmar contraseña', value: pwConfirmacion, onChange: setPwConfirmacion },
              ].map(f => (
                <View key={f.label} style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{f.label}</Text>
                  <TextInput style={styles.input} value={f.value} onChangeText={f.onChange} secureTextEntry placeholderTextColor={Colors.dark[500]} />
                </View>
              ))}
              <TouchableOpacity style={styles.saveBtn} onPress={handleCambiarPassword} disabled={cambiandoPw}>
                {cambiandoPw ? <ActivityIndicator color={Colors.dark[900]} size="small" /> : <Text style={styles.saveBtnText}>Cambiar contraseña</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Acciones de cuenta */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>CUENTA</Text>

          <TouchableOpacity style={styles.accionRow} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color={Colors.dark[400]} />
            <Text style={styles.accionText}>Cerrar sesión</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.dark[600]} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.accionRow}
            onPress={() => Linking.openURL('https://consultoriainmobiliaria.com.mx/eliminacion-de-datos')}
          >
            <Ionicons name="information-circle-outline" size={20} color={Colors.dark[400]} />
            <Text style={styles.accionText}>Política de eliminación de datos</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.dark[600]} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.accionRow, styles.accionDanger]} onPress={handleCancelacion}>
            <Ionicons name="trash-outline" size={20} color="#dc2626" />
            <Text style={[styles.accionText, styles.accionDangerText]}>Cancelar y eliminar mi cuenta</Text>
            <Ionicons name="chevron-forward" size={16} color="#dc2626" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:    { flex: 1, backgroundColor: Colors.dark[900] },
  center:  { alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: Spacing.base, gap: Spacing.base },
  header:  { alignItems: 'center', paddingVertical: Spacing.xl },
  avatarBtn: { position: 'relative', marginBottom: Spacing.base },
  avatar:    { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.dark[700], alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.gold[400] },
  avatarEdit:{ position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.gold[400], alignItems: 'center', justifyContent: 'center' },
  userName:  { fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.bold, color: Colors.cream[50] },
  userEmail: { fontSize: Typography.fontSize.sm, color: Colors.dark[400], marginTop: 2 },
  verificadoBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.sm, backgroundColor: '#f0fdf4', paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full },
  verificadoText:  { fontSize: Typography.fontSize.xs, color: '#15803d', fontWeight: Typography.fontWeight.semibold },
  card:         { backgroundColor: Colors.dark[800], borderRadius: Radius.lg, padding: Spacing.xl },
  cardHeaderRow:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.base },
  sectionTitle: { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold, color: Colors.dark[400], letterSpacing: 1.5 },
  editLink:     { fontSize: Typography.fontSize.sm, color: Colors.gold[400] },
  dataRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.dark[700] },
  dataLabel: { fontSize: Typography.fontSize.sm, color: Colors.dark[400] },
  dataValue: { fontSize: Typography.fontSize.sm, color: Colors.cream[200], fontWeight: Typography.fontWeight.medium },
  inputGroup: { marginBottom: Spacing.base },
  inputLabel: { fontSize: Typography.fontSize.xs, color: Colors.dark[400], marginBottom: Spacing.xs },
  input:      { backgroundColor: Colors.dark[700], borderRadius: Radius.md, padding: Spacing.base, color: Colors.cream[50], fontSize: Typography.fontSize.base },
  editBtns:   { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  cancelBtn:  { flex: 1, backgroundColor: Colors.dark[700], borderRadius: Radius.md, padding: Spacing.base, alignItems: 'center' },
  cancelBtnText:{ fontSize: Typography.fontSize.sm, color: Colors.cream[200] },
  saveBtn:    { flex: 1, backgroundColor: Colors.gold[400], borderRadius: Radius.md, padding: Spacing.base, alignItems: 'center' },
  saveBtnText:{ fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.bold, color: Colors.dark[900] },
  accionRow:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.base, paddingVertical: Spacing.base, borderBottomWidth: 1, borderBottomColor: Colors.dark[700] },
  accionText:    { flex: 1, fontSize: Typography.fontSize.base, color: Colors.cream[200] },
  accionDanger:  { borderBottomWidth: 0, marginTop: Spacing.sm },
  accionDangerText:{ color: '#dc2626' },
});
