import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, Image, TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing } from '../../src/theme';
import Input  from '../../src/components/ui/Input';
import Button from '../../src/components/ui/Button';
import { login, loginWithToken } from '../../src/services/api';
import { registrarPushToken } from '../../src/services/notifications';
import {
  isBiometricAvailable,
  isBiometricEnabled,
  enableBiometric,
  getBiometricLabel,
  authenticateWithBiometric,
} from '../../src/services/biometrics';

export default function LoginScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled,   setBiometricEnabled]   = useState(false);
  const [biometricLabel,     setBiometricLabel]     = useState('Biometría');

  useEffect(() => {
    (async () => {
      const available = await isBiometricAvailable();
      const enabled   = await isBiometricEnabled();
      const label     = await getBiometricLabel();
      setBiometricAvailable(available);
      setBiometricEnabled(enabled);
      setBiometricLabel(label);
    })();
  }, []);

  // Si biometría está disponible y activada, lanzar automáticamente al montar
  useEffect(() => {
    if (biometricAvailable && biometricEnabled) {
      handleBiometricLogin();
    }
  }, [biometricAvailable, biometricEnabled]);

  const handleBiometricLogin = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const result = await authenticateWithBiometric();
      if (!result) { setLoading(false); return; }
      await loginWithToken(result.token);
      registrarPushToken().catch(() => {}); // fire-and-forget
      router.replace('/(tabs)');
    } catch {
      setError('La sesión guardada expiró. Inicia sesión con tu contraseña.');
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleLogin() {
    if (!email || !password) { setError('Ingresa correo y contraseña.'); return; }
    setError('');
    setLoading(true);
    try {
      const state = await login(email.trim().toLowerCase(), password);

      // Si biometría disponible y no activada, activarla ahora
      if (biometricAvailable && !biometricEnabled && state.token) {
        await enableBiometric(email.trim().toLowerCase(), state.token);
        setBiometricEnabled(true);
      }

      registrarPushToken().catch(() => {}); // fire-and-forget
      router.replace('/(tabs)');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Credenciales incorrectas.');
    } finally {
      setLoading(false);
    }
  }

  const biometricIcon = biometricLabel === 'Face ID' ? 'scan-outline' : 'finger-print-outline';

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo / branding */}
        <View style={styles.brand}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.goldBar} />
          <Text style={styles.title}>CONSULTORÍA</Text>
          <Text style={styles.titleAccent}>INMOBILIARIA</Text>
          <Text style={styles.subtitle}>FOVISSSTE · INFONAVIT</Text>
          <View style={styles.goldBar} />
        </View>

        {/* Tarjeta de login */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ACCESO</Text>
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
            placeholder="asesor@ejemplo.com"
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

          {/* Olvidé mi contraseña */}
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

          {/* Botón biométrico */}
          {biometricAvailable && biometricEnabled && (
            <TouchableOpacity
              style={styles.biometricBtn}
              onPress={handleBiometricLogin}
              disabled={loading}
            >
              <Ionicons name={biometricIcon as any} size={28} color={Colors.gold[400]} />
              <Text style={styles.biometricText}>Entrar con {biometricLabel}</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.footer}>
          © 2025 Consultoría Inmobiliaria · Uso exclusivo asesores
        </Text>
        <Text style={styles.version}>
          v{Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
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

  brand: {
    alignItems:   'center',
    marginBottom: Spacing['3xl'],
  },
  logo: {
    width:        120,
    height:       120,
    borderRadius: 16,
    marginBottom: Spacing.lg,
  },
  goldBar: {
    width:           80,
    height:          2,
    backgroundColor: Colors.gold[400],
    marginVertical:  Spacing.sm,
  },
  title: {
    fontSize:      Typography.fontSize['3xl'],
    fontWeight:    Typography.fontWeight.black,
    color:         Colors.cream[50],
    letterSpacing: Typography.letterSpacing.widest,
  },
  titleAccent: {
    fontSize:      Typography.fontSize['3xl'],
    fontWeight:    Typography.fontWeight.black,
    color:         Colors.gold[400],
    letterSpacing: Typography.letterSpacing.widest,
  },
  subtitle: {
    fontSize:      Typography.fontSize.sm,
    color:         Colors.dark[400],
    letterSpacing: Typography.letterSpacing.wider,
    marginTop:     Spacing.xs,
  },

  card: {
    width:           '100%',
    backgroundColor: Colors.white,
    borderRadius:    4,
    padding:         Spacing['2xl'],
    borderTopWidth:  3,
    borderTopColor:  Colors.gold[400],
  },
  cardTitle: {
    fontSize:      Typography.fontSize.xl,
    fontWeight:    Typography.fontWeight.black,
    color:         Colors.dark[900],
    letterSpacing: Typography.letterSpacing.widest,
    marginBottom:  Spacing.xs,
  },
  cardDivider: {
    width:           32,
    height:          2,
    backgroundColor: Colors.gold[400],
    marginBottom:    Spacing.xl,
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth:     1,
    borderColor:     '#fecaca',
    borderRadius:    4,
    padding:         Spacing.md,
    marginBottom:    Spacing.base,
  },
  errorText: {
    color:    Colors.crimson[600],
    fontSize: Typography.fontSize.sm,
  },
  forgotRow: {
    alignSelf:    'flex-end',
    marginTop:    -Spacing.xs,
    marginBottom: Spacing.base,
  },
  forgotText: {
    fontSize: Typography.fontSize.sm,
    color:    Colors.gold[600] ?? '#b45309',
  },
  loginBtn: {
    marginTop: Spacing.sm,
  },
  biometricBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    marginTop:      Spacing.lg,
    gap:            Spacing.sm,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.dark[100] ?? '#f3f4f6',
  },
  biometricText: {
    fontSize:   Typography.fontSize.base,
    color:      Colors.dark[700] ?? '#374151',
    fontWeight: Typography.fontWeight.medium,
  },

  footer: {
    marginTop: Spacing['2xl'],
    fontSize:  Typography.fontSize.xs,
    color:     Colors.dark[500],
    textAlign: 'center',
  },

  version: {
    marginTop: Spacing.xs,
    fontSize:  Typography.fontSize.xs,
    color:     Colors.dark[600],
    textAlign: 'center',
  },
});
