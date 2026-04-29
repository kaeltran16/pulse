import { View, Text } from 'react-native';
import { useTheme } from '@/lib/theme/provider';
import { colors, type } from '@/lib/theme/tokens';
import type { ReviewPatternProse, ReviewSignals } from '@/lib/api-types';

type Palette = typeof colors.light | typeof colors.dark;

type Props = {
  patterns: ReviewPatternProse[];
  signals: ReviewSignals;
};

function colorTokenToHex(token: string, palette: Palette): string {
  switch (token) {
    case 'rituals': return palette.rituals;
    case 'accent':  return palette.accent;
    case 'move':    return palette.move;
    case 'money':   return palette.money;
    case 'cyan':    return palette.cyan;
    default:        return palette.rituals;
  }
}

function colorForPattern(p: ReviewPatternProse, signals: ReviewSignals, palette: Palette): string {
  switch (p.signal) {
    case 'topSpendDay': return palette.money;
    case 'ritualVsNonRitual': return palette.move;
    case 'bestStreak': return signals.bestStreak?.color ? colorTokenToHex(signals.bestStreak.color, palette) : palette.rituals;
    case 'underBudget': return palette.money;
  }
}

export function PatternsList({ patterns, signals }: Props) {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  if (patterns.length === 0) return null;
  return (
    <View style={{ marginHorizontal: 16, marginBottom: 16, gap: 8 }}>
      <Text style={{ ...type.headline, color: palette.ink, marginBottom: 4 }}>Patterns</Text>
      {patterns.map((p, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            backgroundColor: palette.surface,
            borderRadius: 12,
            padding: 12,
            gap: 12,
          }}
        >
          <View style={{ width: 3, borderRadius: 2, backgroundColor: colorForPattern(p, signals, palette) }} />
          <Text style={{ ...type.body, color: palette.ink, flex: 1, lineHeight: 22 }}>{p.text}</Text>
        </View>
      ))}
    </View>
  );
}
