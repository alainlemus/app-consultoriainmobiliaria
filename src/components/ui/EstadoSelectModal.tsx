import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  FlatList, TextInput, SafeAreaView,
} from 'react-native';
import { ESTADOS_MX } from '../../data/mexico';
import { Colors, Typography, Spacing, Radius } from '../../theme';

interface Props {
  value:       string;
  onChange:    (v: string) => void;
  placeholder?: string;
}

/**
 * Campo select para los 32 estados de México.
 * Abre un modal tipo "sheet" con buscador en tiempo real.
 * Uso:
 *   <EstadoSelectModal value={estadoUso} onChange={setEstadoUso} placeholder="Ej: Hidalgo" />
 */
export default function EstadoSelectModal({ value, onChange, placeholder = 'Seleccionar estado' }: Props) {
  const [open,  setOpen]  = useState(false);
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? ESTADOS_MX.filter(e => e.toLowerCase().includes(query.toLowerCase()))
    : ESTADOS_MX;

  function handleOpen() {
    setQuery('');
    setOpen(true);
  }

  return (
    <>
      {/* ── Trigger ─────────────────────────────────────────────────── */}
      <TouchableOpacity style={styles.trigger} onPress={handleOpen} activeOpacity={0.7}>
        <Text style={[styles.triggerText, !value && styles.placeholder]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Text style={styles.arrow}>▾</Text>
      </TouchableOpacity>

      {/* ── Modal hoja ──────────────────────────────────────────────── */}
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.sheet}>
          {/* Cabecera */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Seleccionar estado</Text>
            <TouchableOpacity onPress={() => setOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Buscador */}
          <View style={styles.searchWrap}>
            <TextInput
              style={styles.search}
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar estado…"
              placeholderTextColor={Colors.dark[400]}
              autoFocus
              clearButtonMode="while-editing"
            />
          </View>

          {/* Opción "Sin especificar" */}
          <TouchableOpacity
            style={styles.clearRow}
            onPress={() => { onChange(''); setOpen(false); }}
          >
            <Text style={styles.clearText}>Sin especificar</Text>
            {!value && <Text style={styles.check}>✓</Text>}
          </TouchableOpacity>

          {/* Lista de estados */}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.option}
                onPress={() => { onChange(item); setOpen(false); }}
              >
                <Text style={[styles.optionText, value === item && styles.optionTextActive]}>
                  {item}
                </Text>
                {value === item ? <Text style={styles.check}>✓</Text> : null}
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  triggerText: { flex: 1, fontSize: Typography.fontSize.sm, color: Colors.dark[900] },
  placeholder: { color: Colors.dark[400] },
  arrow:       { fontSize: 13, color: Colors.dark[400], marginLeft: 4 },

  sheet:  { flex: 1, backgroundColor: Colors.white },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    padding:           Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cream[200],
  },
  headerTitle: {
    fontSize:   Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
    color:      Colors.dark[900],
  },
  close: { fontSize: 18, color: Colors.dark[500] },

  searchWrap: { padding: Spacing.base, paddingBottom: Spacing.sm },
  search: {
    backgroundColor:   Colors.cream[100],
    borderRadius:      Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical:   Spacing.sm,
    fontSize:          Typography.fontSize.sm,
    color:             Colors.dark[900],
    borderWidth:       1,
    borderColor:       Colors.cream[300],
  },

  clearRow: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: Spacing.base,
    paddingVertical:   Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cream[200],
  },
  clearText: {
    flex:       1,
    fontSize:   Typography.fontSize.sm,
    color:      Colors.dark[400],
    fontStyle:  'italic',
  },

  option: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: Spacing.base,
    paddingVertical:   14,
  },
  optionText:       { flex: 1, fontSize: Typography.fontSize.sm, color: Colors.dark[800] },
  optionTextActive: { color: Colors.dark[900], fontWeight: Typography.fontWeight.semibold },
  check:            { fontSize: 14, color: Colors.gold[600], marginLeft: 4 },
  separator:        { height: 1, backgroundColor: Colors.cream[100], marginHorizontal: Spacing.base },
});
