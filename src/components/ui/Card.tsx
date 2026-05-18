import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Spacing, Radius, Shadows, Typography } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  style?: ViewStyle;
  dark?: boolean;
  noPadding?: boolean;
}

export default function Card({ children, title, subtitle, style, dark = false, noPadding = false }: CardProps) {
  return (
    <View style={[styles.card, dark && styles.cardDark, noPadding && styles.noPadding, style]}>
      {(title || subtitle) && (
        <View style={styles.header}>
          {subtitle && <Text style={[styles.subtitle, dark && styles.subtitleDark]}>{subtitle.toUpperCase()}</Text>}
          {title   && <Text style={[styles.title,    dark && styles.titleDark]}>{title}</Text>}
          <View style={[styles.divider, dark && styles.dividerDark]} />
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius:    Radius.sm,
    borderWidth:     1,
    borderColor:     Colors.cream[300],
    padding:         Spacing.base,
    ...Shadows.base,
  },
  cardDark: {
    backgroundColor: Colors.dark[800],
    borderColor:     Colors.dark[600],
  },
  noPadding: {
    padding: 0,
  },
  header: {
    marginBottom: Spacing.md,
  },
  subtitle: {
    fontSize:      Typography.fontSize.xs,
    fontWeight:    Typography.fontWeight.semibold,
    color:         Colors.gold[400],
    letterSpacing: Typography.letterSpacing.widest,
    marginBottom:  Spacing.xs,
  },
  subtitleDark: {
    color: Colors.gold[400],
  },
  title: {
    fontSize:   Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color:      Colors.dark[800],
    marginBottom: Spacing.xs,
  },
  titleDark: {
    color: Colors.cream[50],
  },
  divider: {
    width:           32,
    height:          2,
    backgroundColor: Colors.gold[400],
    marginTop:       Spacing.xs,
  },
  dividerDark: {
    backgroundColor: Colors.gold[500],
  },
});
