import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing } from '../../src/theme';
import Input  from '../../src/components/ui/Input';
import Button from '../../src/components/ui/Button';
import { login } from '../../src/services/api';

export default function LoginScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleLogin() {
    if (!email || !password) { setError('Ingresa correo y contraseña.'); return; }
    setError('');
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace('/(tabs)');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Credenciales incorrectas.');
    } finally {
      setLoading(false);
    }
  }

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

          <Button
            label="Iniciar sesión"
            onPress={handleLogin}
            loading={loading}
            fullWidth
            size="lg"
            style={styles.loginBtn}
          />
        </View>

        <Text style={styles.footer}>
          © 2025 Consultoría Inmobiliaria · Uso exclusivo asesores
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
  loginBtn: {
    marginTop: Spacing.sm,
  },

  footer: {
    marginTop: Spacing['2xl'],
    fontSize:  Typography.fontSize.xs,
    color:     Colors.dark[500],
    textAlign: 'center',
  },
});
