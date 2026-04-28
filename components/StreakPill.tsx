import { Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';
import type { RitualColor } from '@/lib/db/schema';

type Palette = typeof colors.light | typeof colors.dark;

function tokenToHex(token: RitualColor, palette: Palette): string {
  switch (token) {
    case 'rituals': return palette.rituals;
    case 'accent':  return palette.accent;
    case 'move':    return palette.move;
    case 'money':   return palette.money;
    case 'cyan':    return palette.cyan;
  }
}

function tokenToTint(token: RitualColor, palette: Palette): string {
  switch (token) {
    case 'rituals': return palette.ritualsTint;
    case 'accent':  return palette.accentTint;
    case 'move':    return palette.moveTint;
    case 'money':   return palette.moneyTint;
    case 'cyan':    return palette.cyanTint;
  }
}

export function StreakPill({ streak, tone = 'rituals' }: { streak: number; tone?: RitualColor }) {
  const { resolved } = useTheme();
  if (streak <= 1) return null;
  const palette = colors[resolved];
  const fg = tokenToHex(tone, palette);
  const bg = tokenToTint(tone, palette);
  return (
    <View
      className="flex-row items-center px-2 py-0.5 rounded-full"
      style={{ backgroundColor: bg, gap: 4 }}
    >
      <SymbolView name="flame.fill" size={11} tintColor={fg} />
      <Text
        className="text-caption2"
        style={{ color: fg, fontWeight: '600', fontVariant: ['tabular-nums'] }}
      >
        {streak}
      </Text>
    </View>
  );
}
