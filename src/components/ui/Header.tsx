import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing } from '../../theme';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightElement?: React.ReactNode;
  dark?: boolean;
}

export default function Header({ title, subtitle, onBack, rightElement, dark = true }: HeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[
      styles.container,
      dark ? styles.containerDark : styles.containerLight,
      { paddingTop: insets.top + Spacing.sm },
    ]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />

      <View style={styles.row}>
        {/* Botón atrás */}
        {onBack ? (
          <TouchableOpacity style={styles.backBtn} onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.backIcon, dark && styles.backIconDark]}>←</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backPlaceholder} />
        )}

        {/* Título central */}
        <View style={styles.titleContainer}>
          {subtitle && (
            <Text style={styles.subtitle}>{subtitle.toUpperCase()}</Text>
          )}
          <Text style={[styles.title, dark ? styles.titleDark : styles.titleLight]} numberOfLines={1}>
            {title}
          </Text>
        </View>

        {/* Elemento derecho */}
        <View style={styles.right}>
          {rightElement ?? <View style={styles.backPlaceholder} />}
        </View>
      </View>

      {/* Separador dorado */}
      <View style={styles.goldLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.base,
    paddingBottom:     Spacing.sm,
  },
  containerDark: {
    backgroundColor: Colors.dark[900],
  },
  containerLight: {
    backgroundColor: Colors.cream[50],
    borderBottomWidth: 1,
    borderBottomColor: Colors.cream[300],
  },
  row: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingBottom:  Spacing.xs,
  },
  backBtn: {
    width:          40,
    alignItems:     'flex-start',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 22,
    color:    Colors.dark[700],
  },
  backIconDark: {
    color: Colors.gold[400],
  },
  backPlaceholder: {
    width: 40,
  },
  titleContainer: {
    flex:      1,
    alignItems:'center',
  },
  subtitle: {
    fontSize:      Typography.fontSize.xs,
    fontWeight:    Typography.fontWeight.semibold,
    color:         Colors.gold[400],
    letterSpacing: Typography.letterSpacing.widest,
    marginBottom:  2,
  },
  title: {
    fontSize:   Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  titleDark: {
    color: Colors.cream[50],
  },
  titleLight: {
    color: Colors.dark[900],
  },
  right: {
    width:          40,
    alignItems:     'flex-end',
    justifyContent: 'center',
  },
  goldLine: {
    height:          2,
    backgroundColor: Colors.gold[400],
    marginTop:       Spacing.xs,
    width:           40,
    alignSelf:       'center',
  },
});
