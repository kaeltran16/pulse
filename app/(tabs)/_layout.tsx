import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';

import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export default function TabsLayout() {
  const { resolved } = useTheme();
  const palette = colors[resolved];

  const icon =
    (name: string) =>
    ({ color, size }: { color: string; size: number }) => (
      <SymbolView name={name as never} size={size} tintColor={color} />
    );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.ink3,
        tabBarStyle: { backgroundColor: palette.surface, borderTopColor: palette.hair },
      }}
    >
      <Tabs.Screen name="today"   options={{ title: 'Today',   tabBarIcon: icon('circle.grid.2x2.fill') }} />
      <Tabs.Screen name="move"    options={{ title: 'Move',    tabBarIcon: icon('figure.run') }} />
      <Tabs.Screen name="rituals" options={{ title: 'Rituals', tabBarIcon: icon('sparkles') }} />
      <Tabs.Screen name="you"     options={{ title: 'You',     tabBarIcon: icon('person.crop.circle') }} />
    </Tabs>
  );
}
