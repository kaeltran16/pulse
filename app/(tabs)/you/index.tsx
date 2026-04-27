import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

type Palette = typeof colors.light | typeof colors.dark;

type Row = {
  key: string;
  icon: string;
  iconBg: string;
  title: string;
  value?: string;
  disabled?: boolean;
  onPress?: () => void;
};

type Section = { title: string; rows: Row[] };

function ListRow({ row, isLast, palette }: { row: Row; isLast: boolean; palette: Palette }) {
  const muted = row.disabled === true;
  return (
    <Pressable
      onPress={muted ? undefined : row.onPress}
      disabled={muted}
      className="flex-row items-center px-4 py-3"
      style={{ borderBottomWidth: isLast ? 0 : 0.5, borderBottomColor: palette.hair, opacity: muted ? 0.55 : 1 }}
    >
      <View
        className="h-8 w-8 rounded-lg items-center justify-center mr-3"
        style={{ backgroundColor: row.iconBg }}
      >
        <SymbolView name={row.icon as never} size={16} tintColor="#fff" />
      </View>
      <Text className="flex-1 text-callout text-ink">{row.title}</Text>
      {row.value !== undefined && (
        <Text className="text-callout text-ink3 mr-1">{row.value}</Text>
      )}
      {!muted && <Text className="text-ink4">›</Text>}
    </Pressable>
  );
}

export default function YouTabLanding() {
  const { resolved } = useTheme();
  const palette = colors[resolved];

  const sections: Section[] = [
    {
      title: 'Reviews',
      rows: [
        { key: 'weekly', icon: 'calendar', iconBg: palette.rituals, title: 'Weekly review', value: 'Coming soon', disabled: true },
        { key: 'monthly', icon: 'chart.bar.fill', iconBg: palette.accent, title: 'Monthly review', value: 'Coming soon', disabled: true },
      ],
    },
    {
      title: 'Money',
      rows: [
        { key: 'bills', icon: 'house.fill', iconBg: palette.accent, title: 'Bills', value: 'Coming soon', disabled: true },
        { key: 'subscriptions', icon: 'repeat', iconBg: palette.rituals, title: 'Subscriptions', value: 'Coming soon', disabled: true },
      ],
    },
    {
      title: 'Integrations',
      rows: [
        { key: 'email-sync', icon: 'tray.fill', iconBg: palette.accent, title: 'Email sync', value: 'Not connected', disabled: true },
      ],
    },
    {
      title: 'Data',
      rows: [
        { key: 'stats', icon: 'chart.bar.fill', iconBg: palette.move, title: 'All stats', value: 'Coming soon', disabled: true },
        { key: 'export', icon: 'tray.fill', iconBg: '#8E8E93', title: 'Export data', value: 'Coming soon', disabled: true },
        { key: 'notif', icon: 'bell.fill', iconBg: '#FF9500', title: 'Notifications', value: 'Coming soon', disabled: true },
      ],
    },
    {
      title: 'Account',
      rows: [
        { key: 'settings', icon: 'gearshape.fill', iconBg: '#8E8E93', title: 'Settings', value: 'Coming soon', disabled: true },
        { key: 'help', icon: 'heart.fill', iconBg: '#FF3B30', title: 'Help & feedback', value: 'Coming soon', disabled: true },
      ],
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-4 py-3">
          <Text className="text-largeTitle text-ink">You</Text>
        </View>
        {sections.map((s) => (
          <View key={s.title} className="px-3 pb-4">
            <Text className="text-caption1 text-ink3 uppercase mb-1 px-1">{s.title}</Text>
            <View className="rounded-xl bg-surface overflow-hidden">
              {s.rows.map((row, i) => (
                <ListRow key={row.key} row={row} isLast={i === s.rows.length - 1} palette={palette} />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
