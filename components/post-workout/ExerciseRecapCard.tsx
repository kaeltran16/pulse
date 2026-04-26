import { Text, View } from 'react-native';

import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';
import type { SessionSet } from '@/lib/db/schema';

export function ExerciseRecapCard({
  exerciseName,
  sets,
}: {
  exerciseName: string;
  sets: SessionSet[];
}) {
  const { resolved } = useTheme();
  const palette = colors[resolved];

  const total = sets.reduce((s, x) => s + (x.weightKg ?? 0) * (x.reps ?? 0), 0);
  const maxVol = Math.max(1, ...sets.map((s) => (s.weightKg ?? 0) * (s.reps ?? 0)));
  const hasPr = sets.some((s) => s.isPr === 1);

  return (
    <View style={{ marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 14, backgroundColor: palette.surface, borderWidth: 0.5, borderColor: palette.hair }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 8, gap: 8 }}>
        {hasPr ? (
          <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: palette.money, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 10 }}>★</Text>
          </View>
        ) : null}
        <Text style={{ flex: 1, color: palette.ink, fontSize: 15, fontWeight: '600' }}>{exerciseName}</Text>
        <Text style={{ color: palette.ink2, fontSize: 13 }}>{Math.round(total)} kg</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 44 }}>
        {sets.map((s, j) => {
          const setVol = (s.weightKg ?? 0) * (s.reps ?? 0);
          const heightPct = (setVol / maxVol) * 100;
          const color = s.isPr === 1 ? palette.money : palette.move;
          return (
            <View key={j} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
              <View style={{ width: '100%', height: `${Math.max(heightPct, 15)}%`, backgroundColor: color, borderTopLeftRadius: 4, borderTopRightRadius: 4, opacity: s.isPr === 1 ? 1 : 0.55 }} />
              <Text style={{ fontSize: 9, color: s.isPr === 1 ? palette.money : palette.ink3 }}>
                {s.weightKg}×{s.reps}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
