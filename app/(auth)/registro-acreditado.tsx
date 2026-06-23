import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, TouchableOpacity, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing } from '../../src/theme';
import Input  from '../../src/components/ui/Input';
import Button from '../../src/components/ui/Button';
import { registrarAcreditado } from '../../src/services/acreditadoApi';
import { registrarPushToken } from '../../src/services/notifications';

export default function RegistroAcreditadoScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  const [name,                  setName]                  = useState('');
  const [email,                 setEmail]                 = useState('');
  const [password,              setPassword]              = useState('');
  const [passwordConfirmation,  setPasswordConfirmation]  = useState('');
  const [curp,                  setCurp]                  = useState('');
  const [telefono,              setTelefono]              = useState('');
  const [loading,               setLoading]               = useState(false);
  const [error,                 setError]                 = useState('');

  async function handleRegistro() {
    if (!name.trim() || !email.trim() || !password) {
      setError('Nombre, correo y contraseña son obligatorios.');
      return;
    }
    if (password !== passwordConfirmation) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const result = await registrarAcreditado({
        name:                  name.trim(),
        email:                 email.trim().toLowerCase(),
        password,
        password_confirmation: passwordConfirmation,
        curp:                  curp.trim().toUpperCase() || undefined,
        telefono:              telefono.trim() || undefined,
      });

      registrarPushToken().catch(() => {});
      router.replace('/(acreditado)');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al crear la cuenta.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.container, {
          paddingTop:    insets.top + Spacing.lg,
          paddingBottom: insets.bottom + Spacing['2xl'],
        }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.cream[50]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Crear cuenta</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>REGISTRO ACREDITADO</Text>
          <View style={styles.cardDivider} />
          <Text style={styles.cardSubtitle}>
            Crea tu cuenta para consultar el estado de tu trámite de crédito.
          </Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Input
            label="Nombre completo *"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            placeholder="Nombre como en tu INE"
            dark={false}
          />

          <Input
            label="Correo electrónico *"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="correo@ejemplo.com"
            dark={false}
          />

          <Input
            label="Contraseña *"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Mínimo 8 caracteres"
            dark={false}
          />

          <Input
            label="Confirmar contraseña *"
            value={passwordConfirmation}
            onChangeText={setPasswordConfirmation}
            secureTextEntry
            placeholder="Repite tu contraseña"
            dark={false}
          />

          <View style={styles.separator}>
            <View style={styles.separatorLine} />
            <Text style={styles.separatorText}>Datos opcionales para vincular tu expediente</Text>
            <View style={styles.separatorLine} />
          </View>

          <Input
            label="CURP"
            value={curp}
            onChangeText={v => setCurp(v.toUpperCase())}
            autoCapitalize="characters"
            maxLength={18}
            placeholder="18 caracteres"
            dark={false}
          />

          <Input
            label="Teléfono"
            value={telefono}
            onChangeText={setTelefono}
            keyboardType="phone-pad"
            placeholder="10 dígitos"
            dark={false}
          />

          <View style={styles.curpHint}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.dark[500]} />
            <Text style={styles.curpHintText}>
              Si ingresas tu CURP, el sistema buscará automáticamente tu expediente activo.
            </Text>
          </View>

          <Button
            label="Crear cuenta"
            onPress={handleRegistro}
            loading={loading}
            fullWidth
            size="lg"
            style={styles.btn}
          />

          <TouchableOpacity style={styles.loginRow} onPress={() => router.back()}>
            <Text style={styles.loginText}>
              ¿Ya tienes cuenta? <Text style={styles.loginLink}>Inicia sesión</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => Linking.openURL('https://consultoriainmobiliaria.com.mx/aviso-de-privacidad')}>
          <Text style={styles.privacyLink}>Aviso de Privacidad · Eliminación de datos</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.dark[900] },
  container: { flexGrow: 1, paddingHorizontal: Spacing['2xl'], alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: Spacing['2xl'], paddingTop: Spacing.sm },
  backBtn: { padding: Spacing.sm },
  headerTitle: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, color: Colors.cream[50] },
  card: { width: '100%', backgroundColor: Colors.white, borderRadius: 8, padding: Spacing['2xl'], borderTopWidth: 4, borderTopColor: Colors.gold[400] },
  cardTitle:    { fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.black, color: Colors.dark[900], letterSpacing: Typography.letterSpacing.widest, marginBottom: Spacing.xs },
  cardDivider:  { width: 32, height: 3, backgroundColor: Colors.gold[400], marginBottom: Spacing.base, borderRadius: 2 },
  cardSubtitle: { fontSize: Typography.fontSize.sm, color: Colors.dark[500], marginBottom: Spacing.xl, lineHeight: Typography.fontSize.sm * 1.5 },
  errorBox:  { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 6, padding: Spacing.md, marginBottom: Spacing.base },
  errorText: { color: '#dc2626', fontSize: Typography.fontSize.sm },
  separator:      { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.xl, gap: Spacing.sm },
  separatorLine:  { flex: 1, height: 1, backgroundColor: Colors.cream[200] },
  separatorText:  { fontSize: Typography.fontSize.xs, color: Colors.dark[400], textAlign: 'center', flexShrink: 1 },
  curpHint:     { flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.cream[50], padding: Spacing.base, borderRadius: 6, marginBottom: Spacing.lg, alignItems: 'flex-start' },
  curpHintText: { flex: 1, fontSize: Typography.fontSize.xs, color: Colors.dark[500], lineHeight: Typography.fontSize.xs * 1.6 },
  btn:      { marginTop: Spacing.base },
  loginRow: { marginTop: Spacing.lg, alignItems: 'center' },
  loginText: { fontSize: Typography.fontSize.sm, color: Colors.dark[600] },
  loginLink: { color: Colors.gold[600] ?? '#b45309', fontWeight: Typography.fontWeight.semibold },
  privacyLink: { marginTop: Spacing.xl, fontSize: Typography.fontSize.xs, color: Colors.gold[400], textAlign: 'center', textDecorationLine: 'underline' },
});
