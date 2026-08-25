/**
 * Pantalla: Editar plantilla del contrato — solo super_admin.
 *
 * Edita el texto de "Contrato de Prestación de Servicios" (el mismo que se
 * administra en Filament > "Contratos para clientes") directamente desde la
 * app. Al guardar: se sube al backend (PUT /contratos/prestacion-servicios/
 * config) y se actualiza la caché local (KEYS.CONTRATO_PRESTACION_SERVICIOS)
 * para que los contratos que se generen de inmediato ya usen el texto nuevo,
 * sin esperar al próximo "Sincronizar".
 *
 * El gate de acceso aquí es solo de UI — el backend debe validar el rol
 * super_admin también en el endpoint.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Header from '@/src/components/ui/Header';
import Button from '@/src/components/ui/Button';
import Input from '@/src/components/ui/Input';
import { Colors, Typography, Spacing } from '@/src/theme';
import { useAuth } from '@/src/contexts/AuthContext';
import { getContratoConfig } from '@/src/contratos/prestacionServicios';
import { updateContratoPrestacionServiciosConfig, type ContratoPrestacionServiciosConfig } from '@/src/services/api';
import { KEYS } from '@/src/services/offline';

const CONFIG_VACIA: ContratoPrestacionServiciosConfig = {
  site_name: '', firma_prestador: '', firma_juridico: '', domicilio_prestador: '',
  contrato_intro: '', contrato_declaraciones_prestador: '', contrato_declaraciones_interesado: '', contrato_clausulas: '',
};

export default function EditarPlantillaScreen() {
  const router = useRouter();
  const { isSuperAdmin } = useAuth();

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [config, setConfig] = useState<ContratoPrestacionServiciosConfig>(CONFIG_VACIA);

  useEffect(() => {
    if (!isSuperAdmin) { router.back(); return; }
    (async () => {
      setConfig(await getContratoConfig());
      setCargando(false);
    })();
  }, [isSuperAdmin]);

  function set<K extends keyof ContratoPrestacionServiciosConfig>(key: K, value: string) {
    setConfig(c => ({ ...c, [key]: value }));
  }

  async function guardar() {
    setGuardando(true);
    try {
      const actualizado = await updateContratoPrestacionServiciosConfig(config);
      await AsyncStorage.setItem(KEYS.CONTRATO_PRESTACION_SERVICIOS, JSON.stringify(actualizado));
      Alert.alert('Guardado', 'La plantilla se actualizó. Los contratos nuevos ya usarán este texto.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo guardar la plantilla.');
    } finally {
      setGuardando(false);
    }
  }

  if (!isSuperAdmin) return null;

  if (cargando) {
    return (
      <View style={[s.flex, s.centered]}>
        <ActivityIndicator size="large" color={Colors.gold[400]} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="Editar plantilla" subtitle="Solo administrador" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Text style={s.hint}>
          Este texto se usa en todos los contratos que se generen de aquí en adelante, de
          cualquier asesor. Revísalo con cuidado antes de guardar.
        </Text>

        <Text style={s.seccion}>Datos generales</Text>
        <Input label="Nombre del sitio" dark value={config.site_name} onChangeText={v => set('site_name', v)} />
        <Input label="Firma del prestador" dark value={config.firma_prestador} onChangeText={v => set('firma_prestador', v)} />
        <Input label="Firma del jurídico" dark value={config.firma_juridico} onChangeText={v => set('firma_juridico', v)} />
        <Input label="Domicilio del prestador" dark value={config.domicilio_prestador} onChangeText={v => set('domicilio_prestador', v)} />

        <Text style={s.seccion}>Introducción</Text>
        <Input dark value={config.contrato_intro} onChangeText={v => set('contrato_intro', v)} multiline numberOfLines={6} containerStyle={s.textarea} />

        <Text style={s.seccion}>Declaraciones — El prestador</Text>
        <Input dark value={config.contrato_declaraciones_prestador} onChangeText={v => set('contrato_declaraciones_prestador', v)} multiline numberOfLines={8} containerStyle={s.textarea} />

        <Text style={s.seccion}>Declaraciones — El interesado (y obligado solidario)</Text>
        <Input dark value={config.contrato_declaraciones_interesado} onChangeText={v => set('contrato_declaraciones_interesado', v)} multiline numberOfLines={8} containerStyle={s.textarea} />

        <Text style={s.seccion}>Cláusulas</Text>
        <Input dark value={config.contrato_clausulas} onChangeText={v => set('contrato_clausulas', v)} multiline numberOfLines={12} containerStyle={s.textarea} />

        <Text style={s.placeholdersHint}>
          Placeholders disponibles: {'{acreditado}'}, {'{curp}'}, {'{rfc}'}, {'{nss}'}, {'{dom_acreditado}'},{' '}
          {'{tipo_tramite}'}, {'{obligado_solidario}'}, {'{monto_credito}'}, {'{pct_honorarios}'},{' '}
          {'{monto_honorarios}'}, {'{folio}'}, {'{ciudad}'}, {'{fecha}'}, {'{domicilio}'}, {'{site_name}'}.
        </Text>

        <Button label="Guardar plantilla" onPress={guardar} loading={guardando} fullWidth style={{ marginTop: Spacing.xl }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.dark[900] },
  centered: { alignItems: 'center', justifyContent: 'center' },
  body: { padding: Spacing.base, paddingBottom: Spacing['3xl'] },
  hint: { fontSize: Typography.fontSize.xs, color: Colors.dark[400], marginBottom: Spacing.base, lineHeight: 18 },
  seccion: {
    fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.bold, color: Colors.gold[400],
    textTransform: 'uppercase', letterSpacing: 1, marginTop: Spacing.base, marginBottom: Spacing.xs,
  },
  textarea: { marginBottom: Spacing.base },
  placeholdersHint: { fontSize: Typography.fontSize.xs, color: Colors.dark[500], lineHeight: 18, marginTop: Spacing.sm },
});
