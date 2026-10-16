import { type ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  Modal as RNModal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useColorScheme,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Color } from '../../src/engine/types';
import { COLOR_LABEL, DISCLAIMER } from '../../src/ui/format';

const light = {
  bg: '#f6f5f1',
  card: '#ffffff',
  text: '#1f2421',
  muted: '#69716c',
  line: '#e2e0d9',
  accent: '#2f6b4f',
  accentText: '#ffffff',
  red: '#c0392b',
  redBg: '#fbeae7',
  orange: '#c46f1c',
  orangeBg: '#fdf1e3',
  green: '#2e8b57',
  greenBg: '#e7f5ec',
  blue: '#2f6fb3',
  blueBg: '#e8f0fa',
  grey: '#8a8f8c',
  greyBg: '#eeefed',
  purple: '#7d4cb3',
  purpleBg: '#f2ebfa',
};
const dark: typeof light = {
  bg: '#141715',
  card: '#1d211f',
  text: '#e8ebe9',
  muted: '#9aa39e',
  line: '#2f3532',
  accent: '#5bb38a',
  accentText: '#0d1a13',
  red: '#e06b5d',
  redBg: '#3a1d19',
  orange: '#e3a052',
  orangeBg: '#3a2a17',
  green: '#5cc28a',
  greenBg: '#183225',
  blue: '#6aa3e0',
  blueBg: '#172537',
  grey: '#9aa39e',
  greyBg: '#262a28',
  purple: '#b08ae0',
  purpleBg: '#2a1f38',
};
export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export function colorOf(t: Theme, c: Color | 'accent') {
  return { red: t.red, orange: t.orange, green: t.green, blue: t.blue, grey: t.grey, purple: t.purple, accent: t.accent }[c];
}
export function bgOf(t: Theme, c: Color) {
  return { red: t.redBg, orange: t.orangeBg, green: t.greenBg, blue: t.blueBg, grey: t.greyBg, purple: t.purpleBg }[c];
}

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const t = useTheme();
  if (!scroll) return <View style={{ flex: 1, backgroundColor: t.bg, padding: 16 }}>{children}</View>;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 64, gap: 12 }} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function T({ children, style, muted, small, bold, size }: { children: ReactNode; style?: StyleProp<TextStyle>; muted?: boolean; small?: boolean; bold?: boolean; size?: number }) {
  const t = useTheme();
  return (
    <Text
      style={[
        { color: muted ? t.muted : t.text, fontSize: size ?? (small ? 13 : 16), lineHeight: (size ?? (small ? 13 : 16)) * 1.4 },
        bold && { fontWeight: '700' },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function H({ children, level = 2 }: { children: ReactNode; level?: 1 | 2 | 3 }) {
  return (
    <T bold size={level === 1 ? 24 : level === 2 ? 19 : 16}>
      {children}
    </T>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const t = useTheme();
  const s = [{ backgroundColor: t.card, borderRadius: 14, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: t.line, gap: 8 }, style];
  if (onPress)
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [...s, pressed && { opacity: 0.7 }]}>
        {children}
      </Pressable>
    );
  return <View style={s}>{children}</View>;
}

export function Row({ children, style, wrap }: { children: ReactNode; style?: StyleProp<ViewStyle>; wrap?: boolean }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, wrap && { flexWrap: 'wrap' }, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled,
  busy,
  small,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  busy?: boolean;
  small?: boolean;
}) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.accent : kind === 'secondary' ? t.greyBg : kind === 'danger' ? t.redBg : 'transparent';
  const fg = kind === 'primary' ? t.accentText : kind === 'danger' ? t.red : kind === 'ghost' ? t.accent : t.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: bg,
        borderRadius: 11,
        paddingVertical: small ? 7 : 12,
        paddingHorizontal: small ? 11 : 16,
        opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        alignItems: 'center',
        alignSelf: small ? 'flex-start' : 'stretch',
      })}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontWeight: '700', fontSize: small ? 14 : 16 }}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, value, onChange, placeholder, multiline, keyboard, autoCapitalize }: { label?: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; keyboard?: 'default' | 'decimal-pad' | 'email-address' | 'number-pad'; autoCapitalize?: 'none' | 'sentences' }) {
  const t = useTheme();
  return (
    <View style={{ gap: 4, flex: 1 }}>
      {label ? <T small muted>{label}</T> : null}
      <TextInput
        accessibilityLabel={label ?? placeholder}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={t.muted}
        multiline={multiline}
        keyboardType={keyboard ?? 'default'}
        autoCapitalize={autoCapitalize}
        style={{ backgroundColor: t.bg, color: t.text, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: t.line, padding: 10, fontSize: 16, minHeight: multiline ? 70 : undefined }}
      />
    </View>
  );
}

/** Campo numerico: accetta la virgola; vuoto = nessun valore (mai zero). */
export function NumField({ label, value, onChange, placeholder }: { label?: string; value: number | null; onChange: (v: number | null) => void; placeholder?: string }) {
  const [text, setText] = useState(value === null || value === undefined ? '' : String(value).replace('.', ','));
  const [last, setLast] = useState(value);
  if (value !== last) {
    setLast(value);
    const parsed = Number(text.replace(',', '.'));
    if (!(text !== '' && parsed === value)) setText(value === null || value === undefined ? '' : String(value).replace('.', ','));
  }
  return (
    <Field
      label={label}
      value={text}
      placeholder={placeholder}
      keyboard="decimal-pad"
      onChange={(s) => {
        setText(s);
        const n = Number(s.replace(',', '.'));
        onChange(s.trim() === '' ? null : Number.isFinite(n) ? n : null);
      }}
    />
  );
}

export function Toggle({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const t = useTheme();
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <T style={{ flex: 1 }}>{label}</T>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: t.accent }} />
    </Row>
  );
}

export function Choice<V extends string | null>({ options, value, onChange }: { options: { value: V; label: string }[]; value: V; onChange: (v: V) => void }) {
  const t = useTheme();
  return (
    <Row wrap>
      {options.map((o) => (
        <Pressable
          key={String(o.value)}
          accessibilityRole="radio"
          accessibilityState={{ selected: o.value === value }}
          onPress={() => onChange(o.value)}
          style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: o.value === value ? t.accent : t.greyBg }}
        >
          <Text style={{ color: o.value === value ? t.accentText : t.text, fontWeight: '600' }}>{o.label}</Text>
        </Pressable>
      ))}
    </Row>
  );
}

export function Check({ label, value, onChange, right }: { label: ReactNode; value: boolean; onChange: (v: boolean) => void; right?: ReactNode }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: value }} onPress={() => onChange(!value)} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 8 }}>
      <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: value ? t.accent : t.muted, backgroundColor: value ? t.accent : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
        {value ? <Text style={{ color: t.accentText, fontWeight: '900', fontSize: 13 }}>✓</Text> : null}
      </View>
      <View style={{ flex: 1 }}>{typeof label === 'string' ? <T>{label}</T> : label}</View>
      {right}
    </Pressable>
  );
}

export function Badge({ label, color = 'green' }: { label: string; color?: 'green' | 'orange' | 'grey' | 'red' | 'purple' | 'blue' }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: bgOf(t, color), borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' }}>
      <Text style={{ color: colorOf(t, color), fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function Dot({ color }: { color: Color }) {
  const t = useTheme();
  return <View accessibilityLabel={COLOR_LABEL[color]} style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colorOf(t, color) }} />;
}

export function Box({ color, children }: { color: Color; children: ReactNode }) {
  const t = useTheme();
  return <View style={{ backgroundColor: bgOf(t, color), borderLeftWidth: 4, borderLeftColor: colorOf(t, color), borderRadius: 12, padding: 12, gap: 6 }}>{children}</View>;
}

export function ErrorBox({ error }: { error: string | null | undefined }) {
  if (!error) return null;
  return (
    <Box color="red">
      <T>{error}</T>
    </Box>
  );
}

export function Bullets({ items, small }: { items: string[]; small?: boolean }) {
  return (
    <View style={{ gap: 4 }}>
      {items.map((s, i) => (
        <T key={i} small={small}>
          • {s}
        </T>
      ))}
    </View>
  );
}

export function Disclaimer({ compact }: { compact?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.blueBg, borderRadius: 12, padding: 12 }}>
      <T small={compact}>⚕︎ {DISCLAIMER}</T>
    </View>
  );
}

export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const t = useTheme();
  return (
    <RNModal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top', 'bottom']}>
        <Row style={{ justifyContent: 'space-between', padding: 16, paddingBottom: 4 }}>
          <View style={{ flex: 1 }}>
            <H level={2}>{title}</H>
          </View>
          <Button title="Chiudi" kind="ghost" small onPress={onClose} />
        </Row>
        <Screen>{children}</Screen>
      </SafeAreaView>
    </RNModal>
  );
}

export function Loading({ label = 'Caricamento…' }: { label?: string }) {
  return (
    <Screen scroll={false}>
      <Row>
        <ActivityIndicator />
        <T muted>{label}</T>
      </Row>
    </Screen>
  );
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.line, marginVertical: 4 }} />;
}
