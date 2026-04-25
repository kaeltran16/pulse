import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme, type Mode } from '@/lib/theme/provider';
import { colors, type, type ColorKey, type TypeKey } from '@/lib/theme/tokens';

const COLOR_GROUPS: { label: string; keys: ColorKey[] }[] = [
  { label: 'Surfaces',       keys: ['bg', 'surface', 'surface2'] },
  { label: 'Inks',           keys: ['ink', 'ink2', 'ink3', 'ink4'] },
  { label: 'Structure',      keys: ['hair', 'blur', 'fill'] },
  { label: 'Accents',        keys: ['money', 'move', 'rituals', 'accent', 'red'] },
  { label: 'Tinted accents', keys: ['moneyTint', 'moveTint', 'ritualsTint', 'accentTint'] },
];

const TYPE_KEYS = Object.keys(type) as TypeKey[];

const MODES: Mode[] = ['light', 'dark', 'system'];

function ModeToggle() {
  const { mode, setMode } = useTheme();
  return (
    <View className="flex-row rounded-lg border border-hair overflow-hidden">
      {MODES.map((m) => {
        const active = m === mode;
        return (
          <Pressable
            key={m}
            onPress={() => setMode(m)}
            className={active ? 'bg-accent px-3 py-1.5' : 'bg-surface px-3 py-1.5'}
          >
            <Text className={active ? 'text-surface' : 'text-ink2'} style={{ fontSize: 13 }}>
              {m[0].toUpperCase() + m.slice(1)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Swatch({ name, hex }: { name: ColorKey; hex: string }) {
  return (
    <View className="flex-row items-center py-1.5">
      <View
        className="w-8 h-8 rounded border border-hair mr-3"
        style={{ backgroundColor: hex }}
      />
      <Text className="text-ink" style={{ fontSize: 15, fontWeight: '600', minWidth: 120 }}>
        {name}
      </Text>
      <Text className="text-ink3" style={{ fontSize: 13 }}>
        {hex}
      </Text>
    </View>
  );
}

function TypeSample({ name }: { name: TypeKey }) {
  const t = type[name];
  return (
    <View className="py-2">
      <Text className="text-ink3" style={{ fontSize: 11 }}>
        {name} · {t.size}/{t.lineHeight}/{t.weight}
      </Text>
      <Text
        className="text-ink"
        style={{ fontSize: t.size, lineHeight: t.lineHeight, fontWeight: t.weight as any }}
      >
        The quick brown fox jumps
      </Text>
    </View>
  );
}

export default function Preview() {
  const { resolved } = useTheme();
  const palette = colors[resolved];

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row justify-between items-center px-4 py-3">
        <Text className="text-ink" style={{ fontSize: 22, fontWeight: '700' }}>
          Pulse — preview
        </Text>
        <ModeToggle />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}>
        <Text className="text-ink2 mt-2 mb-1" style={{ fontSize: 17, fontWeight: '600' }}>
          Colors ({resolved})
        </Text>
        {COLOR_GROUPS.map((group) => (
          <View key={group.label} className="mb-3">
            <Text className="text-ink3 mt-2 mb-1" style={{ fontSize: 12 }}>
              {group.label}
            </Text>
            {group.keys.map((k) => (
              <Swatch key={k} name={k} hex={palette[k]} />
            ))}
          </View>
        ))}

        <Text className="text-ink2 mt-4 mb-1" style={{ fontSize: 17, fontWeight: '600' }}>
          Typography
        </Text>
        {TYPE_KEYS.map((k) => (
          <TypeSample key={k} name={k} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
