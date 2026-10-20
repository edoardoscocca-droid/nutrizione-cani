import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { View, type ColorValue } from 'react-native';
import { FONTS, useTheme } from '../../lib/ui';

// icona della sezione: quella attiva sta su una pillola gialla (stile «Chiaro, colori pieni»)
function Pill({ focused, children }: { focused: boolean; children: React.ReactNode }) {
  const t = useTheme();
  return <View style={{ width: 56, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? t.peach : 'transparent' }}>{children}</View>;
}
function DogIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
  return (
    <Pill focused={focused}>
      <MaterialCommunityIcons name="dog-side" size={22} color={focused ? '#14141f' : (color as string)} />
    </Pill>
  );
}
const feather = (name: React.ComponentProps<typeof Feather>['name']) => {
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return (
      <Pill focused={focused}>
        <Feather name={name} size={20} color={focused ? '#14141f' : (color as string)} />
      </Pill>
    );
  }
  return TabIcon;
};

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        // barra chiara in basso, sezione attiva su pillola gialla (stile «Chiaro, colori pieni»)
        tabBarStyle: { backgroundColor: t.nav, borderTopColor: t.line, borderTopWidth: 1, height: 88, paddingTop: 8 },
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.navText,
        tabBarLabelStyle: { fontFamily: FONTS.bodyBold, fontSize: 11, marginTop: 2 },
        headerStyle: { backgroundColor: t.bg },
        headerShadowVisible: false,
        headerTitleStyle: { color: t.text, fontFamily: FONTS.display, fontSize: 20 },
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Cani', tabBarIcon: DogIcon }} />
      <Tabs.Screen name="catalogo" options={{ title: 'Catalogo', tabBarIcon: feather('book-open') }} />
      <Tabs.Screen name="prezzi" options={{ title: 'Prezzi', tabBarIcon: feather('tag') }} />
      <Tabs.Screen name="impostazioni" options={{ title: 'Impostazioni', tabBarIcon: feather('settings') }} />
    </Tabs>
  );
}
