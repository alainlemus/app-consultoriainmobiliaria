import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, Image, TouchableOpacity, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing } from '../../src/theme';
import Input  from '../../src/components/ui/Input';
import Button from '../../src/components/ui/Button';
import { login, loginWithToken } from '../../src/services/api';
import { loginAcreditado, loginWithTokenAcreditado } from '../../src/services/acreditadoApi';
import { registrarPushToken, registrarPushTokenAcreditado } from '../../src/services/notifications';
import {
  isBiometricAvailable,
  getBiometricTipo,
  enableBiometric,
  getBiometricLabel,
  authenticateWithBiometric,
  type BiometricTipo,
} from '../../src/services/biometrics';
import { isSmallScreen, screenHeight } from '../../src/utils/responsive';

type Modo = 'selector' | 'asesor' | 'acreditado';

export default function LoginScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  const [modo,     setModo]     = useState<Modo>('selector');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  // Qué tipo de cuenta tiene biometría activa en este dispositivo (o null si ninguna) —
  // storage de un solo slot, ver comentario en src/services/biometrics.ts
  const [biometricTipo,  setBiometricTipo]  = useState<BiometricTipo | null>(null);
  const [biometricLabel, setBiometricLabel] = useState('Biometría');

  useEffect(() => {
    (async () => {
      const disponible = await isBiometricAvailable();
      const tipo       = await getBiometricTipo();
      setBiometricAvailable(disponible);
      setBiometricTipo(tipo);
      setBiometricLabel(await getBiometricLabel());
      // Si ya hay biometría activada, saltar directo a esa pantalla (asesor
      // o acreditado) en vez de esperar a que el usuario toque el botón —
      // así Face ID se dispara solo al abrir la app, sin ese paso extra.
      if (disponible && tipo) setModo(tipo);
    })();
  }, []);

  // Auto-disparar biometría al entrar al modo que coincide con lo guardado
  useEffect(() => {
    if (biometricAvailable && modo !== 'selector' && biometricTipo === modo) {
      handleBiometricLogin();
    }
  }, [modo, biometricAvailable, biometricTipo]);

  const handleBiometricLogin = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const result = await authenticateWithBiometric();
      if (!result) { setLoading(false); return; }
      if (result.tipo === 'acreditado') {
        await loginWithTokenAcreditado(result.token);
        registrarPushTokenAcreditado().catch(() => {});
        router.replace('/(acreditado)');
      } else {
        await loginWithToken(result.token);
        registrarPushToken().catch(() => {});
        router.replace('/(tabs)');
      }
    } catch {
      setError('La sesión guardada expiró. Inicia sesión con tu contraseña.');
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleLoginAsesor() {
    if (!email || !password) { setError('Ingresa correo y contraseña.'); return; }
    setError('');
    setLoading(true);
    try {
      const state = await login(email.trim().toLowerCase(), password);
      if (biometricAvailable && biometricTipo !== 'asesor' && state.token) {
        await enableBiometric(email.trim().toLowerCase(), state.token, 'asesor');
        setBiometricTipo('asesor');
      }
      registrarPushToken().catch(() => {});
      router.replace('/(tabs)');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Credenciales incorrectas.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLoginAcreditado() {
    if (!email || !password) { setError('Ingresa correo y contraseña.'); return; }
    setError('');
    setLoading(true);
    try {
      const state = await loginAcreditado(email.trim().toLowerCase(), password);
      if (biometricAvailable && biometricTipo !== 'acreditado' && state.token) {
        await enableBiometric(email.trim().toLowerCase(), state.token, 'acreditado');
        setBiometricTipo('acreditado');
      }
      // registrarPushTokenAcreditado usa /v1/acreditado/dispositivos (con el
      // token del acreditado) — no el endpoint del asesor, que causaba un 401
      // y forzaba un logout global (ver acreditadoFetch/apiFetch).
      registrarPushTokenAcreditado().catch(() => {});
      router.replace('/(acreditado)');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Credenciales incorrectas.');
    } finally {
      setLoading(false);
    }
  }

  const biometricIcon = biometricLabel === 'Face ID' ? 'scan-outline' : 'finger-print-outline';
  const logoSize      = isSmallScreen ? 80 : 110;
  const brandMargin   = isSmallScreen ? Spacing.xl : Spacing['3xl'];
  const showLogo      = screenHeight >= 640;

  // ── Branding común ──────────────────────────────────────────────────────────
  const Branding = (
    <View style={[styles.brand, { marginBottom: brandMargin }]}>
      {showLogo && (
        <Image
          source={require('../../assets/icon.png')}
          style={[styles.logo, { width: logoSize, height: logoSize }]}
          resizeMode="contain"
        />
      )}
      <View style={styles.goldBar} />
      <Text style={styles.title}>CONSULTORÍA</Text>
      <Text style={styles.titleAccent}>INMOBILIARIA</Text>
      <Text style={styles.subtitle}>FOVISSSTE · INFONAVIT</Text>
      <View style={styles.goldBar} />
    </View>
  );

  // ── Pantalla selector ───────────────────────────────────────────────────────
  if (modo === 'selector') {
    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.container, {
            paddingTop:    insets.top + (isSmallScreen ? Spacing.lg : Spacing['2xl']),
            paddingBottom: insets.bottom + Spacing['2xl'],
          }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {Branding}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>¿CÓMO QUIERES ENTRAR?</Text>
            <View style={styles.cardDivider} />
            <Text style={styles.selectorSubtitle}>Selecciona tu tipo de acceso</Text>

            <TouchableOpacity style={styles.selectorBtn} onPress={() => { setModo('asesor'); setError(''); }}>
              <View style={styles.selectorIcon}>
                <Ionicons name="briefcase-outline" size={28} color={Colors.gold[400]} />
              </View>
              <View style={styles.selectorText}>
                <Text style={styles.selectorTitle}>Soy Asesor</Text>
                <Text style={styles.selectorDesc}>Gestiona prospectos, expedientes y comisiones</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.dark[400]} />
            </TouchableOpacity>

            <View style={styles.selectorSeparator} />

            <TouchableOpacity style={styles.selectorBtn} onPress={() => { setModo('acreditado'); setError(''); }}>
              <View style={[styles.selectorIcon, styles.selectorIconAlt]}>
                <Ionicons name="home-outline" size={28} color={Colors.gold[400]} />
              </View>
              <View style={styles.selectorText}>
                <Text style={styles.selectorTitle}>Soy Acreditado</Text>
                <Text style={styles.selectorDesc}>Consulta el estado de tu trámite de crédito</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.dark[400]} />
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>© 2026 Consultoría Inmobiliaria</Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://consultoriainmobiliaria.com.mx/aviso-de-privacidad')}>
            <Text style={styles.privacyLink}>Aviso de Privacidad</Text>
          </TouchableOpacity>
          <Text style={styles.version}>v{Constants.expoConfig?.version ?? '2.0.6'}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Login asesor / acreditado ───────────────────────────────────────────────
  const esAsesor = modo === 'asesor';

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.container, {
          paddingTop:    insets.top + (isSmallScreen ? Spacing.lg : Spacing['2xl']),
          paddingBottom: insets.bottom + Spacing['2xl'],
        }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {Branding}

        <View style={styles.card}>
          {/* Header con botón volver */}
          <View style={styles.cardHeaderRow}>
            <TouchableOpacity onPress={() => { setModo('selector'); setError(''); setEmail(''); setPassword(''); }} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color={Colors.dark[500]} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{esAsesor ? 'ACCESO ASESOR' : 'ACCESO ACREDITADO'}</Text>
              <View style={styles.cardDivider} />
            </View>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Input
            label="Correo electrónico"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="correo@ejemplo.com"
            dark={false}
          />

          <Input
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            dark={false}
          />

          <TouchableOpacity
            onPress={() => router.push(`/(auth)/forgot-password?modo=${modo}`)}
            style={styles.forgotRow}
          >
            <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          <Button
            label="Iniciar sesión"
            onPress={esAsesor ? handleLoginAsesor : handleLoginAcreditado}
            loading={loading}
            fullWidth
            size="lg"
            style={styles.loginBtn}
          />

          {biometricAvailable && biometricTipo === modo && (
            <TouchableOpacity style={styles.biometricBtn} onPress={handleBiometricLogin} disabled={loading}>
              <Ionicons name={biometricIcon as any} size={32} color={Colors.gold[400]} />
              <Text style={styles.biometricText}>Entrar con {biometricLabel}</Text>
            </TouchableOpacity>
          )}

          {!esAsesor && (
            <TouchableOpacity
              style={styles.registerRow}
              onPress={() => router.push('/(auth)/registro-acreditado')}
            >
              <Text style={styles.registerText}>
                ¿No tienes cuenta? <Text style={styles.registerLink}>Regístrate aquí</Text>
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.footer}>© 2026 Consultoría Inmobiliaria</Text>
        <TouchableOpacity onPress={() => Linking.openURL('https://consultoriainmobiliaria.com.mx/aviso-de-privacidad')}>
          <Text style={styles.privacyLink}>Aviso de Privacidad</Text>
        </TouchableOpacity>
        <Text style={styles.version}>v{Constants.expoConfig?.version ?? '2.1.3'}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.dark[900] },
  container: {
    flexGrow:          1,
    paddingHorizontal: Spacing['2xl'],
    alignItems:        'center',
    justifyContent:    'center',
  },
  brand:      { alignItems: 'center', width: '100%' },
  logo:       { borderRadius: 16, marginBottom: Spacing.lg },
  goldBar:    { width: 80, height: 3, backgroundColor: Colors.gold[400], marginVertical: Spacing.sm, borderRadius: 2 },
  title:      { fontSize: Typography.fontSize['3xl'], fontWeight: Typography.fontWeight.black, color: Colors.cream[50], letterSpacing: Typography.letterSpacing.widest },
  titleAccent:{ fontSize: Typography.fontSize['3xl'], fontWeight: Typography.fontWeight.black, color: Colors.gold[400], letterSpacing: Typography.letterSpacing.widest },
  subtitle:   { fontSize: Typography.fontSize.sm, color: Colors.dark[400], letterSpacing: Typography.letterSpacing.wider, marginTop: Spacing.xs },

  card: {
    width:           '100%',
    backgroundColor: Colors.white,
    borderRadius:    8,
    padding:         Spacing['2xl'],
    borderTopWidth:  4,
    borderTopColor:  Colors.gold[400],
  },
  cardHeaderRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.sm },
  backBtn:        { paddingTop: 4, paddingRight: Spacing.sm },
  cardTitle:      { fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.black, color: Colors.dark[900], letterSpacing: Typography.letterSpacing.widest, marginBottom: Spacing.xs },
  cardDivider:    { width: 32, height: 3, backgroundColor: Colors.gold[400], marginBottom: Spacing.xl, borderRadius: 2 },

  selectorSubtitle: { fontSize: Typography.fontSize.sm, color: Colors.dark[500], marginBottom: Spacing.xl, textAlign: 'center' },
  selectorBtn:      { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.lg, gap: Spacing.base },
  selectorIcon:     { width: 48, height: 48, borderRadius: 12, backgroundColor: Colors.cream[50], alignItems: 'center', justifyContent: 'center' },
  selectorIconAlt:  { backgroundColor: '#f0fdf4' },
  selectorText:     { flex: 1 },
  selectorTitle:    { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold, color: Colors.dark[900] },
  selectorDesc:     { fontSize: Typography.fontSize.xs, color: Colors.dark[500], marginTop: 2 },
  selectorSeparator:{ height: 1, backgroundColor: Colors.cream[200], marginHorizontal: -Spacing['2xl'] },

  errorBox:   { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 6, padding: Spacing.md, marginBottom: Spacing.base },
  errorText:  { color: '#dc2626', fontSize: Typography.fontSize.base, lineHeight: Typography.fontSize.base * 1.4 },
  forgotRow:  { alignSelf: 'flex-end', marginTop: Spacing.xs, marginBottom: Spacing.base, padding: Spacing.xs },
  forgotText: { fontSize: Typography.fontSize.sm, color: Colors.gold[600] ?? '#b45309' },
  loginBtn:   { marginTop: Spacing.sm },
  biometricBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: Spacing.lg, gap: Spacing.sm, paddingVertical: Spacing.base, borderTopWidth: 1, borderTopColor: Colors.cream[300], minHeight: 56 },
  biometricText: { fontSize: Typography.fontSize.base, color: Colors.dark[700], fontWeight: Typography.fontWeight.semibold },
  registerRow:   { marginTop: Spacing.lg, alignItems: 'center', paddingTop: Spacing.base, borderTopWidth: 1, borderTopColor: Colors.cream[300] },
  registerText:  { fontSize: Typography.fontSize.sm, color: Colors.dark[600] },
  registerLink:  { color: Colors.gold[600] ?? '#b45309', fontWeight: Typography.fontWeight.semibold },

  footer:      { marginTop: Spacing['2xl'], fontSize: Typography.fontSize.xs, color: Colors.dark[500], textAlign: 'center' },
  version:     { marginTop: Spacing.xs, fontSize: Typography.fontSize.xs, color: Colors.dark[600], textAlign: 'center' },
  privacyLink: { marginTop: Spacing.xs, fontSize: Typography.fontSize.xs, color: Colors.gold[400], textAlign: 'center', textDecorationLine: 'underline' },
});
