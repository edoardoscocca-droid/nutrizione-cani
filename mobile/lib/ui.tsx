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
import { Feather } from '@expo/vector-icons';
import type { Color } from '../../src/engine/types';
import { COLOR_LABEL, DISCLAIMER } from '../../src/ui/format';

// Stile «Caldo e naturale» (scelto il 17/10/2026): crema, terracotta e pesca; titoli Fraunces, testo Nunito Sans.
const light = {
  bg: '#f7f1e8',
  card: '#ffffff',
  input: '#fbf8f3',
  text: '#2c241c',
  muted: '#6e5f50',
  line: '#e6dccf',
  accent: '#9a4a26',
  accentText: '#ffffff',
  peach: '#f2b48a',
  peachBg: '#fbe6d4',
  sage: '#3d5a43',
  sageBg: '#e3eedf',
  nav: '#2c241c',
  navText: '#e9dccb',
  red: '#b3392b',
  redBg: '#fbe4df',
  orange: '#a85f16',
  orangeBg: '#fff1df',
  green: '#3d7a52',
  greenBg: '#e3eedf',
  blue: '#33669c',
  blueBg: '#e6eef7',
  grey: '#776d61',
  greyBg: '#efe8dd',
  purple: '#7d4cb3',
  purpleBg: '#f1eafa',
};
const dark: typeof light = {
  bg: '#1b1713',
  card: '#26201b',
  input: '#2e2721',
  text: '#f3ece2',
  muted: '#b9ab99',
  line: '#3a322a',
  accent: '#f2b48a',
  accentText: '#2c241c',
  peach: '#f2b48a',
  peachBg: '#3b2a1f',
  sage: '#b7d3bd',
  sageBg: '#223026',
  nav: '#0f0c0a',
  navText: '#d8cab7',
  red: '#f09a8c',
  redBg: '#3a201b',
  orange: '#efb36b',
  orangeBg: '#3a2a17',
  green: '#86c99a',
  greenBg: '#1f3326',
  blue: '#8fb7e6',
  blueBg: '#1b2838',
  grey: '#b0a596',
  greyBg: '#2d2620',
  purple: '#c3a2ea',
  purpleBg: '#2c2138',
};
/** Famiglie dei caratteri (caricati in app/_layout.tsx; finché non ci sono, iOS usa il carattere di sistema). */
export const FONTS = {
  display: 'Fraunces_600SemiBold',
  body: 'NunitoSans_400Regular',
  bodySemi: 'NunitoSans_600SemiBold',
  bodyBold: 'NunitoSans_700Bold',
};
const shadow = { shadowColor: '#3c2814', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 };
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
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 14 }} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function T({ children, style, muted, small, bold, size }: { children: ReactNode; style?: StyleProp<TextStyle>; muted?: boolean; small?: boolean; bold?: boolean; size?: number }) {
  const t = useTheme();
  return (
    <Text
      style={[
        { color: muted ? t.muted : t.text, fontSize: size ?? (small ? 14 : 16), lineHeight: (size ?? (small ? 14 : 16)) * 1.4, fontFamily: bold ? FONTS.bodyBold : FONTS.body },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function H({ children, level = 2 }: { children: ReactNode; level?: 1 | 2 | 3 }) {
  const t = useTheme();
  const size = level === 1 ? 30 : level === 2 ? 21 : 18;
  return <Text accessibilityRole="header" style={{ color: t.text, fontFamily: FONTS.display, fontSize: size, lineHeight: size * 1.18 }}>{children}</Text>;
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const t = useTheme();
  const s = [{ backgroundColor: t.card, borderRadius: 22, padding: 16, gap: 8, ...shadow }, style];
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
  const bg = kind === 'primary' ? t.accent : kind === 'secondary' ? t.peachBg : kind === 'danger' ? t.redBg : 'transparent';
  const fg = kind === 'primary' ? t.accentText : kind === 'danger' ? t.red : kind === 'ghost' ? t.accent : t.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: bg,
        borderRadius: 16,
        minHeight: small ? 38 : 50,
        justifyContent: 'center',
        paddingVertical: small ? 8 : 13,
        paddingHorizontal: small ? 14 : 18,
        opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        alignItems: 'center',
        alignSelf: small ? 'flex-start' : 'stretch',
      })}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontFamily: FONTS.bodyBold, fontSize: small ? 14 : 16 }}>{title}</Text>}
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
        style={{ backgroundColor: t.input, color: t.text, borderRadius: 14, borderWidth: 1, borderColor: t.line, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, fontFamily: FONTS.body, minHeight: multiline ? 76 : 46 }}
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
          style={{ paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, minHeight: 38, justifyContent: 'center', backgroundColor: o.value === value ? t.accent : t.peachBg }}
        >
          <Text style={{ color: o.value === value ? t.accentText : t.text, fontFamily: FONTS.bodySemi }}>{o.label}</Text>
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
        {value ? <Feather name="check" size={15} color={t.accentText} /> : null}
      </View>
      <View style={{ flex: 1 }}>{typeof label === 'string' ? <T>{label}</T> : label}</View>
      {right}
    </Pressable>
  );
}

export function Badge({ label, color = 'green' }: { label: string; color?: 'green' | 'orange' | 'grey' | 'red' | 'purple' | 'blue' }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: bgOf(t, color), borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ color: colorOf(t, color), fontSize: 12, fontFamily: FONTS.bodyBold }}>{label}</Text>
    </View>
  );
}

export function Dot({ color }: { color: Color }) {
  const t = useTheme();
  return <View accessibilityLabel={COLOR_LABEL[color]} style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colorOf(t, color) }} />;
}

export function Box({ color, children }: { color: Color; children: ReactNode }) {
  const t = useTheme();
  return <View style={{ backgroundColor: bgOf(t, color), borderRadius: 18, paddingVertical: 12, paddingHorizontal: 16, gap: 6 }}>{children}</View>;
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
    <View style={{ backgroundColor: t.sageBg, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 16 }}>
      <T small={compact}>{DISCLAIMER}</T>
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
  return <View style={{ height: 0, borderTopWidth: 1, borderStyle: 'dashed', borderColor: t.line, marginVertical: 4 }} />;
}
