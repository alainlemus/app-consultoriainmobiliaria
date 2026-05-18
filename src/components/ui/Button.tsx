import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../../theme';

type Variant = 'gold' | 'dark' | 'outline' | 'ghost' | 'danger';
type Size    = 'sm' | 'base' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export default function Button({
  label,
  onPress,
  variant  = 'gold',
  size     = 'base',
  loading  = false,
  disabled = false,
  style,
  textStyle,
  fullWidth = false,
}: ButtonProps) {
  const containerStyle = [
    styles.base,
    styles[variant],
    styles[`size_${size}`],
    fullWidth && { alignSelf: 'stretch' as const },
    (disabled || loading) && styles.disabled,
    style,
  ];

  const labelStyle = [
    styles.label,
    styles[`label_${variant}`],
    styles[`labelSize_${size}`],
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'gold' ? Colors.dark[900] : Colors.gold[400]}
          size="small"
        />
      ) : (
        <Text style={labelStyle}>{label.toUpperCase()}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    borderRadius:   Radius.sm,
    borderWidth:    1,
    borderColor:    'transparent',
  },
  // Variantes
  gold: {
    backgroundColor: Colors.gold[400],
    borderColor:     Colors.gold[400],
  },
  dark: {
    backgroundColor: Colors.dark[800],
    borderColor:     Colors.gold[500],
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor:     Colors.gold[400],
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor:     'transparent',
  },
  danger: {
    backgroundColor: Colors.crimson[600],
    borderColor:     Colors.crimson[600],
  },
  disabled: {
    opacity: 0.5,
  },
  // Tamaños
  size_sm: {
    paddingHorizontal: Spacing.md,
    paddingVertical:   Spacing.xs,
  },
  size_base: {
    paddingHorizontal: Spacing.xl,
    paddingVertical:   Spacing.md,
  },
  size_lg: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical:   Spacing.base,
  },
  // Labels
  label: {
    letterSpacing: Typography.letterSpacing.widest,
    fontWeight:    Typography.fontWeight.semibold,
  },
  label_gold:    { color: Colors.dark[900] },
  label_dark:    { color: Colors.gold[400] },
  label_outline: { color: Colors.gold[400] },
  label_ghost:   { color: Colors.gold[500] },
  label_danger:  { color: Colors.white },
  labelSize_sm:   { fontSize: Typography.fontSize.xs },
  labelSize_base: { fontSize: Typography.fontSize.sm },
  labelSize_lg:   { fontSize: Typography.fontSize.base },
});
