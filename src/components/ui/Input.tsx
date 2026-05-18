import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ViewStyle, TextInputProps, TouchableOpacity } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../../theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  containerStyle?: ViewStyle;
  dark?: boolean;
}

export default function Input({ label, error, hint, containerStyle, dark = false, secureTextEntry, ...rest }: InputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={[styles.label, dark && styles.labelDark]}>{label}</Text>}
      <View style={styles.row}>
        <TextInput
          style={[
            styles.input,
            dark   && styles.inputDark,
            error  && styles.inputError,
            secureTextEntry && styles.inputWithIcon,
          ]}
          placeholderTextColor={dark ? Colors.dark[400] : Colors.dark[400]}
          secureTextEntry={secureTextEntry && !visible}
          {...rest}
        />
        {secureTextEntry && (
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setVisible(v => !v)}>
            <Text style={styles.eyeIcon}>{visible ? '🙈' : '👁'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      {hint  && !error && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.base,
  },
  label: {
    fontSize:     Typography.fontSize.sm,
    fontWeight:   Typography.fontWeight.semibold,
    color:        Colors.dark[700],
    marginBottom: Spacing.xs,
    letterSpacing: Typography.letterSpacing.wide,
    textTransform: 'uppercase',
  },
  labelDark: {
    color: Colors.cream[200],
  },
  row: {
    position: 'relative',
  },
  input: {
    backgroundColor: Colors.cream[100],
    borderWidth:     1,
    borderColor:     Colors.cream[300],
    borderRadius:    Radius.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical:   Spacing.md,
    fontSize:        Typography.fontSize.base,
    color:           Colors.dark[800],
  },
  inputDark: {
    backgroundColor: Colors.dark[700],
    borderColor:     Colors.dark[600],
    color:           Colors.cream[50],
  },
  inputError: {
    borderColor: Colors.crimson[500],
  },
  inputWithIcon: {
    paddingRight: 44,
  },
  eyeBtn: {
    position: 'absolute',
    right:    12,
    top:      0,
    bottom:   0,
    justifyContent: 'center',
  },
  eyeIcon: {
    fontSize: 16,
  },
  error: {
    fontSize:    Typography.fontSize.xs,
    color:       Colors.crimson[500],
    marginTop:   Spacing.xs,
  },
  hint: {
    fontSize:    Typography.fontSize.xs,
    color:       Colors.dark[400],
    marginTop:   Spacing.xs,
  },
});
