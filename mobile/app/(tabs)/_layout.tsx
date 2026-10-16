import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { useTheme } from '../../lib/ui';

const icon = (s: string) => {
  function TabIcon({ color }: { color: ColorValue }) {
    return <Text style={{ color, fontSize: 18 }}>{s}</Text>;
  }
  return TabIcon;
};

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: t.accent,
        tabBarStyle: { backgroundColor: t.card },
        headerStyle: { backgroundColor: t.card },
        headerTitleStyle: { color: t.text },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Cani', tabBarIcon: icon('🐕') }} />
      <Tabs.Screen name="prezzi" options={{ title: 'Prezzi', tabBarIcon: icon('€') }} />
      <Tabs.Screen name="catalogo" options={{ title: 'Catalogo', tabBarIcon: icon('▤') }} />
      <Tabs.Screen name="impostazioni" options={{ title: 'Impostazioni', tabBarIcon: icon('⚙︎') }} />
    </Tabs>
  );
}
