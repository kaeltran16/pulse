import { View, Text } from 'react-native';
import { useTheme } from '@/lib/theme/provider';
import { colors, type } from '@/lib/theme/tokens';
import type { ReviewAggregates } from '@/lib/api-types';

type Props = {
  aggregates: ReviewAggregates;
  bestStreakDays: number | null;
};

export function ByTheNumbers({ aggregates, bestStreakDays }: Props) {
  const { resolved } = useTheme();
  const palette = colors[resolved];

  const rows: Array<{ label: string; value: string; sub: string; color: string }> = [
    {
      label: 'Total spent',
      value: `$${(aggregates.spend.totalMinor / 100).toFixed(0)}`,
      sub: aggregates.spend.currency,
      color: palette.money,
    },
    {
      label: 'Sessions',
      value: String(aggregates.workouts.sessions),
      sub: `${aggregates.workouts.prCount} PRs`,
      color: palette.move,
    },
    {
      label: 'Rituals kept',
      value: `${aggregates.rituals.kept} / ${aggregates.rituals.goalTotal}`,
      sub: aggregates.rituals.goalTotal === 0
        ? '—'
        : `${Math.round((aggregates.rituals.kept / aggregates.rituals.goalTotal) * 100)}%`,
      color: palette.rituals,
    },
  ];
  if (bestStreakDays !== null) {
    rows.push({
      label: 'Best streak',
      value: `${bestStreakDays} days`,
      sub: 'Ritual',
      color: palette.accent,
    });
  }

  return (
    <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
      <Text style={{ ...type.headline, color: palette.ink, marginBottom: 8 }}>By the numbers</Text>
      <View style={{ backgroundColor: palette.surface, borderRadius: 12, padding: 4 }}>
        {rows.map((r, i, arr) => (
          <View
            key={r.label}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 12,
              borderBottomWidth: i < arr.length - 1 ? 0.5 : 0,
              borderBottomColor: palette.hair,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: r.color,
              }}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ ...type.body, color: palette.ink }}>{r.label}</Text>
              <Text style={{ ...type.caption1, color: palette.ink3 }}>{r.sub}</Text>
            </View>
            <Text style={{ ...type.title3, color: palette.ink }}>{r.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
