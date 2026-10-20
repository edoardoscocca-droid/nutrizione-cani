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

// Stile «Chiaro, colori pieni» (scelto il 20/10/2026, proposta D): impostazione chiara e ordinata, blu cobalto,
// giallo, corallo e menta; testo Manrope. I nomi delle chiavi restano quelli dello stile precedente.
const light = {
  bg: '#f5f6fb',
  card: '#ffffff',
  input: '#f7f8fc',
  text: '#14141f',
  muted: '#55556a',
  line: '#e6e7ef',
  accent: '#2f3bd8',
  accentText: '#ffffff',
  peach: '#ffd84d',
  peachBg: '#e9ebff',
  sage: '#0e5a40',
  sageBg: '#eef0f7',
  nav: '#ffffff',
  navText: '#55556a',
  red: '#b3261e',
  redBg: '#fbddda',
  orange: '#9c4a00',
  orangeBg: '#ffead9',
  green: '#0e6b4c',
  greenBg: '#dff7ee',
  blue: '#2a33b8',
  blueBg: '#e9ebff',
  grey: '#55556a',
  greyBg: '#efeff5',
  purple: '#6b3fb3',
  purpleBg: '#f1eafa',
};
const dark: typeof light = {
  bg: '#0f1020',
  card: '#1a1c30',
  input: '#22253b',
  text: '#f1f2f8',
  muted: '#a9abc2',
  line: '#2c2f48',
  accent: '#9aa2ff',
  accentText: '#0f1020',
  peach: '#ffd84d',
  peachBg: '#262a55',
  sage: '#6fddb3',
  sageBg: '#20223a',
  nav: '#1a1c30',
  navText: '#a9abc2',
  red: '#ff9a8f',
  redBg: '#3a1c1c',
  orange: '#ffb27a',
  orangeBg: '#3a2616',
  green: '#6fddb3',
  greenBg: '#12352a',
  blue: '#a9b0ff',
  blueBg: '#20244a',
  grey: '#a9abc2',
  greyBg: '#26283c',
  purple: '#c3a2ea',
  purpleBg: '#2c2138',
};
/** Famiglie dei caratteri (caricati in app/_layout.tsx; finché non ci sono, iOS usa il carattere di sistema). */
export const FONTS = {
  display: 'Manrope_800ExtraBold',
  body: 'Manrope_500Medium',
  bodySemi: 'Manrope_600SemiBold',
  bodyBold: 'Manrope_700Bold',
};
const shadow = { shadowColor: '#14141f', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 };
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
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }} keyboardShouldPersistTaps="handled">
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
  return <Text accessibilityRole="header" style={{ color: t.text, fontFamily: FONTS.display, fontSize: size, lineHeight: size * 1.2, letterSpacing: level === 1 ? -0.6 : -0.3 }}>{children}</Text>;
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const t = useTheme();
  const s = [{ backgroundColor: t.card, borderRadius: 20, padding: 16, gap: 8, ...shadow }, style];
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

export function Field({ label, value, onChange, placeholder, multiline, keyboard, autoCapitalize, a11y }: { label?: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; keyboard?: 'default' | 'decimal-pad' | 'email-address' | 'number-pad'; autoCapitalize?: 'none' | 'sentences'; a11y?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 4, flex: 1 }}>
      {label ? <T small muted>{label}</T> : null}
      <TextInput
        accessibilityLabel={a11y ?? label ?? placeholder}
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
export function NumField({ label, value, onChange, placeholder, a11y }: { label?: string; value: number | null; onChange: (v: number | null) => void; placeholder?: string; a11y?: string }) {
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
      a11y={a11y}
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

/** Etichetta di un campo con una piccola icona «?» che apre un aiuto sopra la schermata (i dati inseriti restano). */
export function HelpLabel({ label, onHelp }: { label: string; onHelp: () => void }) {
  const t = useTheme();
  return (
    <Row style={{ gap: 6 }}>
      <T small muted>{label}</T>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Aiuto: ${label}`}
        hitSlop={12}
        onPress={onHelp}
        style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: t.peachBg, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: t.accent }}>?</Text>
      </Pressable>
    </Row>
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
