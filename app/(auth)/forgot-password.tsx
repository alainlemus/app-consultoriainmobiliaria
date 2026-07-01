import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing } from '../../src/theme';
import Input  from '../../src/components/ui/Input';
import Button from '../../src/components/ui/Button';
import { apiFetch } from '../../src/services/api';
import { forgotPasswordAcreditado } from '../../src/services/acreditadoApi';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { modo } = useLocalSearchParams<{ modo?: string }>();
  const esAcreditado = modo === 'acreditado';

  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');

  async function handleSubmit() {
    if (!email) { setError('Ingresa tu correo electrónico.'); return; }
    setError('');
    setLoading(true);
    try {
      if (esAcreditado) {
        await forgotPasswordAcreditado(email.trim().toLowerCase());
      } else {
        await apiFetch('/auth/forgot-password', {
          method: 'POST',
          body:   JSON.stringify({ email: email.trim().toLowerCase() }),
        });
      }
      setSent(true);
    } catch {
      // Siempre mostramos éxito para no revelar si el correo existe
      setSent(true);
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
        {/* Botón volver */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.gold[400]} />
          <Text style={styles.backText}>Volver</Text>
        </TouchableOpacity>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>RECUPERAR ACCESO</Text>
          <View style={styles.cardDivider} />

          {sent ? (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle-outline" size={40} color="#16a34a" style={{ marginBottom: Spacing.md }} />
              <Text style={styles.successTitle}>Revisa tu correo</Text>
              <Text style={styles.successText}>
                Si el correo está registrado, recibirás un enlace para restablecer tu contraseña en los próximos minutos.
              </Text>
              <Button
                label="Volver al inicio de sesión"
                onPress={() => router.replace('/(auth)/login')}
                fullWidth
                size="lg"
                style={{ marginTop: Spacing.xl }}
              />
            </View>
          ) : (
            <>
              <Text style={styles.description}>
                Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
              </Text>

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
                placeholder={esAcreditado ? 'correo@ejemplo.com' : 'asesor@ejemplo.com'}
                dark={false}
              />

              <Button
                label="Enviar enlace"
                onPress={handleSubmit}
                loading={loading}
                fullWidth
                size="lg"
                style={{ marginTop: Spacing.sm }}
              />
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.dark[900] },

  container: {
    flexGrow:          1,
    paddingHorizontal: Spacing['2xl'],
    justifyContent:    'center',
  },

  backBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.xs,
    marginBottom:  Spacing['2xl'],
  },
  backText: {
    color:    Colors.gold[400],
    fontSize: Typography.fontSize.base,
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
  description: {
    fontSize:     Typography.fontSize.sm,
    color:        Colors.dark[600] ?? '#4b5563',
    lineHeight:   22,
    marginBottom: Spacing.lg,
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
  successBox: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  successTitle: {
    fontSize:     Typography.fontSize.xl,
    fontWeight:   Typography.fontWeight.bold,
    color:        Colors.dark[900],
    marginBottom: Spacing.sm,
  },
  successText: {
    fontSize:   Typography.fontSize.sm,
    color:      Colors.dark[600] ?? '#4b5563',
    textAlign:  'center',
    lineHeight: 22,
  },
});
