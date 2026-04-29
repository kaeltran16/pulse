import { View, Text } from 'react-native';
import { useTheme } from '@/lib/theme/provider';
import { colors, type } from '@/lib/theme/tokens';
import type { ReviewAggregates } from '@/lib/api-types';

type Props = { aggregates: ReviewAggregates };

export function ThreeStatSummary({ aggregates }: Props) {
  const { resolved } = useTheme();
  const palette = colors[resolved];

  const cells = [
    {
      label: 'SPENT',
      value: `$${(aggregates.spend.totalMinor / 100).toFixed(0)}`,
      sub: aggregates.spend.currency,
      color: palette.money,
      tint: palette.moneyTint,
    },
    {
      label: 'SESSIONS',
      value: String(aggregates.workouts.sessions),
      sub: `${aggregates.workouts.prCount} PRs`,
      color: palette.move,
      tint: palette.moveTint,
    },
    {
      label: 'RITUALS',
      value: String(aggregates.rituals.kept),
      sub: `of ${aggregates.rituals.goalTotal}`,
      color: palette.rituals,
      tint: palette.ritualsTint,
    },
  ];

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 16,
        padding: 16,
        backgroundColor: palette.surface,
        flexDirection: 'row',
        gap: 8,
      }}
    >
      {cells.map((c) => (
        <View
          key={c.label}
          style={{
            flex: 1,
            padding: 8,
            borderRadius: 8,
            backgroundColor: c.tint,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '600', color: c.color, letterSpacing: 0.3 }}>{c.label}</Text>
          <Text style={{ ...type.title2, color: palette.ink, marginTop: 2 }}>{c.value}</Text>
          <Text style={{ ...type.caption1, color: palette.ink3, marginTop: 1 }}>{c.sub}</Text>
        </View>
      ))}
    </View>
  );
}
