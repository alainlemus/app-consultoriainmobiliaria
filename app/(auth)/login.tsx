import { APP_VERSION } from '../../src/version';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, Image, TouchableOpacity, Linking, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing } from '../../src/theme';
import Input  from '../../src/components/ui/Input';
import Button from '../../src/components/ui/Button';
import { loginWithToken, obtenerTokenBiometrico } from '../../src/services/api';
import { entrar } from '../../src/services/entrar';
import { loginWithTokenAcreditado, obtenerTokenBiometricoAcreditado } from '../../src/services/acreditadoApi';
import { registrarPushToken, registrarPushTokenAcreditado } from '../../src/services/notifications';
import {
  isBiometricAvailable,
  getBiometricTipo,
  enableBiometric,
  disableBiometric,
  getBiometricLabel,
  authenticateWithBiometric,
  type BiometricTipo,
} from '../../src/services/biometrics';
import { isSmallScreen, screenHeight } from '../../src/utils/responsive';
import { inicioStaff, tieneAmbasInterfaces, guardarInterfaz, getInterfazGuardada } from '../../src/utils/rolStaff';


// Módulo (no estado/ref del componente) para que sobreviva a que esta
// pantalla se desmonte y remonte (p. ej. al cerrar sesión) dentro de la
// misma sesión de la app — Face ID debe auto-dispararse solo una vez, al
// abrir la app, no cada vez que se vuelve a este login. Se resetea solo con
// un reinicio real de la app (recarga del bundle de JS).
let autoIntentadoGlobal = false;

export default function LoginScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

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
    })();
  }, []);

  // Auto-disparar biometría si hay una credencial guardada en este celular —
  // SOLO una vez por sesión de la app (ver autoIntentadoGlobal arriba), no
  // una vez por montaje de esta pantalla. Si no fuera así, cada vez que se
  // vuelve a este login (p. ej. tras cerrar sesión) Face ID se dispararía
  // solo otra vez; con el guard, cualquier intento después del primero de la
  // sesión requiere que el usuario toque el botón "Entrar con Face ID".
  useEffect(() => {
    if (autoIntentadoGlobal) return;
    if (biometricAvailable && biometricTipo) {
      autoIntentadoGlobal = true;
      handleBiometricLogin();
    }
  }, [biometricAvailable, biometricTipo]);

  const handleBiometricLogin = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const result = await authenticateWithBiometric();
      if (!result.ok) {
        if (result.reason === 'missing_credential') {
          // Biometría autenticada pero sin credencial guardada detrás —
          // está rota, hay que borrarla o el auto-intento al reabrir esta
          // pantalla vuelve a fallar en silencio (o en ciclo) una y otra vez.
          await disableBiometric();
          setBiometricTipo(null);
          setError('No se encontró una sesión guardada. Inicia sesión con tu correo y contraseña.');
        } else {
          // Cara no reconocida / cancelado — la credencial sigue sirviendo,
          // no hay que borrar nada, solo dejar que reintente.
          setError('No se pudo verificar tu identidad. Intenta de nuevo o usa tu correo y contraseña.');
        }
        setLoading(false);
        return;
      }
      if (result.tipo === 'acreditado') {
        await loginWithTokenAcreditado(result.token);
        registrarPushTokenAcreditado().catch(() => {});
        router.replace('/(acreditado)');
      } else {
        // Asesor y gestor comparten sesión; el rol decide a qué pantallas va.
        // Con ambos roles, la credencial biométrica recuerda con cuál se guardó.
        const state = await loginWithToken(result.token);
        registrarPushToken().catch(() => {});
        const interfaz = result.tipo === 'gestor' ? 'gestor' : 'asesor';
        if (tieneAmbasInterfaces(state.user)) await guardarInterfaz(interfaz);
        router.replace(inicioStaff(state.user, interfaz));
      }
    } catch {
      // El token guardado ya no sirve (expiró/fue revocado). Si dejamos la
      // credencial biométrica intacta, cualquier remount de esta pantalla
      // (p. ej. el redirect a /login que dispara apiFetch en un 401) vuelve
      // a intentar Face ID solo, con el mismo token muerto — un ciclo
      // infinito de prompts. Borrarla aquí corta el ciclo de raíz.
      await disableBiometric();
      setBiometricTipo(null);
      setError('La sesión guardada expiró. Inicia sesión con tu correo y contraseña.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Pregunta si quiere guardar las credenciales para entrar con biometría —
  // antes se guardaban solas y en silencio tras cada login manual exitoso.
  // Se resuelve la promesa hasta que el usuario responde, para no navegar
  // antes de que el diálogo se cierre.
  //
  // Importante: NO reutiliza el token de sesión (state.token) — pide uno
  // aparte al backend (nombre propio 'app-movil-biometric' /
  // 'acreditado-app-biometric'). Si guardáramos el mismo token de sesión,
  // cerrar sesión lo revocaría (logout() borra currentAccessToken()) y Face
  // ID quedaría roto desde el primer logout.
  const preguntarGuardarBiometria = useCallback(
    (tipo: BiometricTipo, emailNorm: string) =>
      new Promise<void>((resolve) => {
        Alert.alert(
          `Usar ${biometricLabel}`,
          `¿Quieres guardar tus credenciales para entrar con ${biometricLabel} la próxima vez?`,
          [
            { text: 'Ahora no', style: 'cancel', onPress: () => resolve() },
            {
              text: 'Guardar', onPress: async () => {
                try {
                  const biomToken = tipo === 'acreditado'
                    ? await obtenerTokenBiometricoAcreditado()
                    : await obtenerTokenBiometrico();
                  await enableBiometric(emailNorm, biomToken, tipo);
                  setBiometricTipo(tipo);
                } catch {
                  Alert.alert('Error', `No se pudo activar ${biometricLabel}. Intenta de nuevo más tarde.`);
                } finally {
                  resolve();
                }
              },
            },
          ],
        );
      }),
    [biometricLabel],
  );

  // Login único: el backend dice si es empleado (asesor, gestor, super admin) o
  // acreditado, y la app abre su interfaz. Quien es gestor y asesor entra a la
  // última interfaz que usó (y cambia desde el inicio o Perfil).
  async function handleLogin() {
    if (!email || !password) { setError('Ingresa correo y contraseña.'); return; }
    setError('');
    setLoading(true);
    const emailNorm = email.trim().toLowerCase();
    try {
      const r = await entrar(emailNorm, password);
      if (r.tipo === 'acreditado') {
        if (biometricAvailable && biometricTipo !== 'acreditado' && r.state.token) {
          await preguntarGuardarBiometria('acreditado', emailNorm);
        }
        // registrarPushTokenAcreditado usa /v1/acreditado/dispositivos (con el
        // token del acreditado) — no el endpoint del asesor, que causaba un 401.
        registrarPushTokenAcreditado().catch(() => {});
        router.replace('/(acreditado)');
        return;
      }
      const user = r.state.user;
      const destino = inicioStaff(user, await getInterfazGuardada());
      const tipoBio: BiometricTipo = destino === '/(gestor)' ? 'gestor' : 'asesor';
      if (tieneAmbasInterfaces(user)) await guardarInterfaz(tipoBio);
      if (biometricAvailable && biometricTipo !== tipoBio && r.state.token) {
        await preguntarGuardarBiometria(tipoBio, emailNorm);
      }
      registrarPushToken().catch(() => {});
      router.replace(destino);
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

  // ── Login (único para todos) ────────────────────────────────────────────────

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
          <Text style={styles.cardTitle}>ENTRA A TU CUENTA</Text>
          <View style={styles.cardDivider} />

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
            onPress={() => router.push('/(auth)/forgot-password')}
            style={styles.forgotRow}
          >
            <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          <Button
            label="Iniciar sesión"
            onPress={handleLogin}
            loading={loading}
            fullWidth
            size="lg"
            style={styles.loginBtn}
          />

          {biometricAvailable && biometricTipo && (
            <TouchableOpacity style={styles.biometricBtn} onPress={handleBiometricLogin} disabled={loading}>
              <Ionicons name={biometricIcon as any} size={32} color={Colors.gold[400]} />
              <Text style={styles.biometricText}>Entrar con {biometricLabel}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.registerRow}
            onPress={() => router.push('/(auth)/registro-acreditado')}
          >
            <Text style={styles.registerText}>
              ¿Tienes o quieres un crédito y aún no tienes cuenta? <Text style={styles.registerLink}>Regístrate aquí</Text>
            </Text>
            <Text style={styles.registerHint}>Asesores y gestores: tu cuenta la crea la consultoría.</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>© 2026 Consultoría Inmobiliaria</Text>
        <TouchableOpacity onPress={() => Linking.openURL('https://consultoriainmobiliaria.com.mx/aviso-de-privacidad')}>
          <Text style={styles.privacyLink}>Aviso de Privacidad</Text>
        </TouchableOpacity>
        <Text style={styles.version}>v{APP_VERSION}</Text>
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
  cardTitle:      { fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.black, color: Colors.dark[900], letterSpacing: Typography.letterSpacing.widest, marginBottom: Spacing.xs },
  cardDivider:    { width: 32, height: 3, backgroundColor: Colors.gold[400], marginBottom: Spacing.xl, borderRadius: 2 },


  errorBox:   { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 6, padding: Spacing.md, marginBottom: Spacing.base },
  errorText:  { color: '#dc2626', fontSize: Typography.fontSize.base, lineHeight: Typography.fontSize.base * 1.4 },
  forgotRow:  { alignSelf: 'flex-end', marginTop: Spacing.xs, marginBottom: Spacing.base, padding: Spacing.xs },
  forgotText: { fontSize: Typography.fontSize.sm, color: Colors.gold[600] ?? '#b45309' },
  loginBtn:   { marginTop: Spacing.sm },
  biometricBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: Spacing.lg, gap: Spacing.sm, paddingVertical: Spacing.base, borderTopWidth: 1, borderTopColor: Colors.cream[300], minHeight: 56 },
  biometricText: { fontSize: Typography.fontSize.base, color: Colors.dark[700], fontWeight: Typography.fontWeight.semibold },
  registerRow:   { marginTop: Spacing.lg, alignItems: 'center', paddingTop: Spacing.base, borderTopWidth: 1, borderTopColor: Colors.cream[300] },
  registerText:  { fontSize: Typography.fontSize.sm, color: Colors.dark[600] },
  registerHint:  { fontSize: Typography.fontSize.xs, color: Colors.dark[400], marginTop: Spacing.xs, textAlign: 'center' },
  registerLink:  { color: Colors.gold[600] ?? '#b45309', fontWeight: Typography.fontWeight.semibold },

  footer:      { marginTop: Spacing['2xl'], fontSize: Typography.fontSize.xs, color: Colors.dark[500], textAlign: 'center' },
  version:     { marginTop: Spacing.xs, fontSize: Typography.fontSize.xs, color: Colors.dark[600], textAlign: 'center' },
  privacyLink: { marginTop: Spacing.xs, fontSize: Typography.fontSize.xs, color: Colors.gold[400], textAlign: 'center', textDecorationLine: 'underline' },
});
