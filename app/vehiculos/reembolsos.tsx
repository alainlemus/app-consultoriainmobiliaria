/** Mis reembolsos de gasolina: las cargas que pagué yo, pendientes y pagadas. */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Header from '@/src/components/ui/Header';
import { Colors, Typography, Spacing } from '@/src/theme';
import { getReembolsos } from '@/src/services/vehiculosApi';
import { diaCorto, horaCorta } from '@/src/utils/citas';
import { pesos } from '@/src/utils/vehiculos';
import { Pildora, ui } from '@/src/components/vehiculos/ui';
import type { Carga } from '@/src/types/vehiculos';

export default function ReembolsosScreen() {
  const router = useRouter();
  const [cargas, setCargas]   = useState<Carga[]>([]);
  const [cargando, setCarg]   = useState(true);
  const [refrescando, setRef] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try { setCargas(await getReembolsos()); setError(null); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'No se pudieron cargar tus reembolsos.'); }
    finally { setCarg(false); setRef(false); }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const pendiente = cargas.filter(c => c.reembolso === 'pendiente').reduce((t, c) => t + c.monto, 0);

  return (
    <View style={s.flex}>
      <Header title="Mis reembolsos" subtitle="Gasolina que pagaste tú" onBack={() => router.back()} />
      {cargando ? <ActivityIndicator color={Colors.gold[400]} style={{ marginTop: Spacing['2xl'] }} /> : (
        <ScrollView
          contentContainerStyle={s.body}
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => { setRef(true); cargar(); }} tintColor={Colors.gold[400]} />}
        >
          {error ? <Text style={s.vacio}>{error}</Text> : null}
          {cargas.length > 0 && (
            <View style={[ui.card, { marginBottom: Spacing.md }]}>
              <Text style={s.sub}>Por cobrar</Text>
              <Text style={s.total}>{pesos(pendiente)}</Text>
            </View>
          )}
          {cargas.length === 0 && !error ? (
            <Text style={s.vacio}>Aún no tienes cargas como reembolso. Cuando pagues gasolina tú, regístrala con «Pagué yo · reembolso».</Text>
          ) : cargas.map(c => (
            <TouchableOpacity
              key={c.id} style={[ui.card, s.item]}
              onPress={() => router.push({ pathname: '/vehiculos/reserva/[id]', params: { id: String(c.reserva_id) } })}
              accessibilityLabel={`Carga de ${pesos(c.monto)}, ${c.reembolso === 'pagado' ? 'pagada' : 'pendiente'}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.fuerte}>{pesos(c.monto)} · {c.litros} L</Text>
                <Text style={s.sub}>{diaCorto(c.creado_at)} {horaCorta(c.creado_at)} · {c.km.toLocaleString('es-MX')} km</Text>
              </View>
              <Pildora texto={c.reembolso === 'pagado' ? 'Pagado' : 'Pendiente'} color={c.reembolso === 'pagado' ? '#15803d' : '#b45309'} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  flex:   { flex: 1, backgroundColor: Colors.cream[50] },
  body:   { padding: Spacing.base, paddingBottom: Spacing['2xl'] * 2 },
  vacio:  { textAlign: 'center', color: Colors.dark[600], marginTop: Spacing.xl, paddingHorizontal: Spacing.lg, lineHeight: 20 },
  item:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
  sub:    { fontSize: Typography.fontSize.xs, color: Colors.dark[500] },
  fuerte: { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold, color: Colors.dark[900] },
  total:  { fontSize: Typography.fontSize['2xl'], fontWeight: Typography.fontWeight.bold, color: Colors.dark[900] },
});
