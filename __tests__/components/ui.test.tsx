/**
 * Tests: componentes UI
 *
 * Cubre:
 *  Button  — render, variantes, estado loading, disabled, onPress, fullWidth
 *  Card    — render, title, subtitle, dark, noPadding
 *  Input   — render, label, error, hint, secureTextEntry toggle, dark
 *  Badge   — render, variantes de color, small, mapeos ESTADO_*_BADGE
 *  Header  — render, title, subtitle, botón atrás, rightElement, dark/light
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';

import Button from '../../src/components/ui/Button';
import Card   from '../../src/components/ui/Card';
import Input  from '../../src/components/ui/Input';
import Badge, { ESTADO_PROSPECTO_BADGE, ESTADO_EXPEDIENTE_BADGE } from '../../src/components/ui/Badge';
import Header from '../../src/components/ui/Header';

// ── Button ─────────────────────────────────────────────────────────────────

describe('Button', () => {
  it('renderiza label en mayúsculas', () => {
    const { getByText } = render(<Button label="iniciar sesión" onPress={jest.fn()} />);
    expect(getByText('INICIAR SESIÓN')).toBeTruthy();
  });

  it('llama onPress al tocar', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button label="Entrar" onPress={onPress} />);
    fireEvent.press(getByText('ENTRAR'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('no llama onPress cuando disabled=true', () => {
    const onPress = jest.fn();
    const { UNSAFE_getByType } = render(
      <Button label="Entrar" onPress={onPress} disabled />
    );
    const { TouchableOpacity } = require('react-native');
    const btn = UNSAFE_getByType(TouchableOpacity);
    // Verifica que el componente tiene disabled
    expect(btn.props.disabled).toBe(true);
  });

  it('muestra ActivityIndicator cuando loading=true', () => {
    const { queryByText, UNSAFE_queryByType } = render(
      <Button label="Cargando" onPress={jest.fn()} loading />
    );
    const { ActivityIndicator } = require('react-native');
    // El texto no debe aparecer cuando loading
    expect(queryByText('CARGANDO')).toBeNull();
  });

  it('renderiza variante danger', () => {
    const { getByText } = render(<Button label="Eliminar" onPress={jest.fn()} variant="danger" />);
    expect(getByText('ELIMINAR')).toBeTruthy();
  });

  it('renderiza todas las variantes sin crash', () => {
    const variants = ['gold', 'dark', 'outline', 'ghost', 'danger'] as const;
    variants.forEach(v => {
      expect(() => render(<Button label="test" onPress={jest.fn()} variant={v} />)).not.toThrow();
    });
  });

  it('renderiza todos los tamaños sin crash', () => {
    const sizes = ['sm', 'base', 'lg'] as const;
    sizes.forEach(s => {
      expect(() => render(<Button label="test" onPress={jest.fn()} size={s} />)).not.toThrow();
    });
  });
});

// ── Card ───────────────────────────────────────────────────────────────────

describe('Card', () => {
  it('renderiza children', () => {
    const { getByText } = render(<Card><Text>Contenido de la tarjeta</Text></Card>);
    expect(getByText('Contenido de la tarjeta')).toBeTruthy();
  });

  it('muestra title y subtitle cuando se proveen', () => {
    const { getByText } = render(<Card title="Mi Título" subtitle="Subtítulo"><></></Card>);
    expect(getByText('Mi Título')).toBeTruthy();
    expect(getByText('SUBTÍTULO')).toBeTruthy(); // subtitle se convierte a uppercase
  });

  it('no muestra header si no hay title ni subtitle', () => {
    const { queryByText } = render(<Card><>sin header</></Card>);
    expect(queryByText('undefined')).toBeNull();
  });

  it('renderiza en modo dark sin crash', () => {
    expect(() => render(<Card dark><>dark</></Card>)).not.toThrow();
  });

  it('renderiza con noPadding sin crash', () => {
    expect(() => render(<Card noPadding><>np</></Card>)).not.toThrow();
  });
});

// ── Input ─────────────────────────────────────────────────────────────────

describe('Input', () => {
  it('muestra label', () => {
    const { getByText } = render(<Input label="Correo" />);
    expect(getByText('Correo')).toBeTruthy();
  });

  it('muestra mensaje de error', () => {
    const { getByText } = render(<Input error="Campo requerido" />);
    expect(getByText('Campo requerido')).toBeTruthy();
  });

  it('muestra hint cuando no hay error', () => {
    const { getByText } = render(<Input hint="Ej: correo@ejemplo.com" />);
    expect(getByText('Ej: correo@ejemplo.com')).toBeTruthy();
  });

  it('no muestra hint si hay error', () => {
    const { queryByText } = render(<Input error="Error" hint="Pista" />);
    expect(queryByText('Pista')).toBeNull();
  });

  it('muestra botón ojo cuando secureTextEntry=true', () => {
    const { queryAllByText } = render(<Input secureTextEntry />);
    // El botón ojo con emoji '👁' debe estar presente
    const eyeButtons = queryAllByText('👁');
    expect(eyeButtons.length).toBeGreaterThan(0);
  });

  it('toggle visibilidad al presionar botón ojo', () => {
    const { getByText, queryByText } = render(<Input secureTextEntry />);
    const eyeBtn = getByText('👁');
    fireEvent.press(eyeBtn);
    // Ahora debe mostrar el ícono de ocultar
    expect(getByText('🙈')).toBeTruthy();
  });

  it('llama onChangeText cuando el usuario escribe', () => {
    const onChange = jest.fn();
    const { getByDisplayValue, UNSAFE_getByType } = render(
      <Input value="abc" onChangeText={onChange} />
    );
    const { TextInput } = require('react-native');
    const input = UNSAFE_getByType(TextInput);
    fireEvent.changeText(input, 'abcd');
    expect(onChange).toHaveBeenCalledWith('abcd');
  });

  it('renderiza en modo dark sin crash', () => {
    expect(() => render(<Input dark label="Oscuro" />)).not.toThrow();
  });
});

// ── Badge ─────────────────────────────────────────────────────────────────

describe('Badge', () => {
  it('renderiza label', () => {
    const { getByText } = render(<Badge label="Nuevo" />);
    expect(getByText('Nuevo')).toBeTruthy();
  });

  it('renderiza todas las variantes sin crash', () => {
    const variants = ['gold', 'dark', 'success', 'warning', 'danger', 'info', 'gray'] as const;
    variants.forEach(v => {
      expect(() => render(<Badge label="Test" variant={v} />)).not.toThrow();
    });
  });

  it('renderiza en modo small sin crash', () => {
    expect(() => render(<Badge label="Test" small />)).not.toThrow();
  });

  it('ESTADO_PROSPECTO_BADGE tiene los estados correctos', () => {
    expect(ESTADO_PROSPECTO_BADGE.nuevo).toBe('info');
    expect(ESTADO_PROSPECTO_BADGE.contactado).toBe('gold');
    expect(ESTADO_PROSPECTO_BADGE.precalificado).toBe('warning');
    expect(ESTADO_PROSPECTO_BADGE.en_tramite).toBe('dark');
    expect(ESTADO_PROSPECTO_BADGE.cerrado).toBe('success');
    expect(ESTADO_PROSPECTO_BADGE.no_interesado).toBe('gray');
  });

  it('ESTADO_EXPEDIENTE_BADGE tiene los estados correctos', () => {
    expect(ESTADO_EXPEDIENTE_BADGE.en_proceso).toBe('info');
    expect(ESTADO_EXPEDIENTE_BADGE.documentacion).toBe('warning');
    expect(ESTADO_EXPEDIENTE_BADGE.autorizado).toBe('gold');
    expect(ESTADO_EXPEDIENTE_BADGE.escrituracion).toBe('dark');
    expect(ESTADO_EXPEDIENTE_BADGE.cerrado).toBe('success');
    expect(ESTADO_EXPEDIENTE_BADGE.cancelado).toBe('danger');
  });
});

// ── Header ────────────────────────────────────────────────────────────────

describe('Header', () => {
  it('renderiza título', () => {
    const { getByText } = render(<Header title="Prospectos" />);
    expect(getByText('Prospectos')).toBeTruthy();
  });

  it('renderiza subtitle en mayúsculas', () => {
    const { getByText } = render(<Header title="Dash" subtitle="panel" />);
    expect(getByText('PANEL')).toBeTruthy();
  });

  it('no muestra subtitle si no se provee', () => {
    const { queryByText } = render(<Header title="Solo Título" />);
    expect(queryByText('SOLO TÍTULO')).toBeNull();
  });

  it('muestra flecha atrás y llama onBack', () => {
    const onBack = jest.fn();
    const { getByText } = render(<Header title="Detalle" onBack={onBack} />);
    fireEvent.press(getByText('←'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('no muestra flecha atrás si no se provee onBack', () => {
    const { queryByText } = render(<Header title="Sin back" />);
    expect(queryByText('←')).toBeNull();
  });

  it('renderiza rightElement', () => {
    const { getByText } = render(
      <Header title="Con acción" rightElement={<Text>Acción</Text>} />
    );
    expect(getByText('Acción')).toBeTruthy();
  });

  it('renderiza en modo light sin crash', () => {
    expect(() => render(<Header title="Light" dark={false} />)).not.toThrow();
  });
});
