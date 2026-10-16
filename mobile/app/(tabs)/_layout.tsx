import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { FONTS, useTheme } from '../../lib/ui';

function DogIcon({ color }: { color: ColorValue }) {
  return <MaterialCommunityIcons name="dog-side" size={22} color={color as string} />;
}
const feather = (name: React.ComponentProps<typeof Feather>['name']) => {
  function TabIcon({ color }: { color: ColorValue }) {
    return <Feather name={name} size={20} color={color as string} />;
  }
  return TabIcon;
};

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        // barra a pillola scura sospesa, scheda attiva color pesca (stile «Caldo e naturale»)
        tabBarStyle: {
          position: 'absolute',
          bottom: 24,
          marginHorizontal: 16,
          height: 66,
          paddingTop: 7,
          paddingBottom: 7,
          paddingHorizontal: 6,
          borderRadius: 28,
          borderTopWidth: 0,
          backgroundColor: t.nav,
        },
        tabBarItemStyle: { borderRadius: 20, marginHorizontal: 2 },
        tabBarActiveBackgroundColor: t.peach,
        tabBarActiveTintColor: '#2c241c',
        tabBarInactiveTintColor: t.navText,
        tabBarLabelStyle: { fontFamily: FONTS.bodyBold, fontSize: 11 },
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
