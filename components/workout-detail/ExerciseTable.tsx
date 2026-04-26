import { Text, View } from 'react-native';

import type { SessionSet } from '@/lib/db/schema';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export function ExerciseTable({
  exerciseName,
  sets,
}: {
  exerciseName: string;
  sets: SessionSet[];
}) {
  const { resolved } = useTheme();
  const palette = colors[resolved];

  const total = sets.reduce((s, x) => s + (x.weightKg ?? 0) * (x.reps ?? 0), 0);

  return (
    <View style={{ paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 0.5, borderColor: palette.hair }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 6 }}>
        <Text style={{ flex: 1, color: palette.ink, fontSize: 16, fontWeight: '600' }}>{exerciseName}</Text>
        <Text style={{ color: palette.ink3, fontSize: 12 }}>
          {sets.length} × {Math.round(total)} kg
        </Text>
      </View>

      <View style={{ flexDirection: 'row', borderBottomWidth: 0.5, borderColor: palette.hair, paddingVertical: 4 }}>
        <Text style={{ width: 32, color: palette.ink3, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>SET</Text>
        <Text style={{ flex: 1, color: palette.ink3, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>KG</Text>
        <Text style={{ flex: 1, color: palette.ink3, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>REPS</Text>
        <View style={{ width: 40 }} />
      </View>
      {sets.map((s, j) => (
        <View key={j} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
          <Text style={{ width: 32, color: palette.ink3, fontSize: 13, fontWeight: '600' }}>{j + 1}</Text>
          <Text style={{ flex: 1, color: palette.ink, fontSize: 15, fontWeight: '600' }}>{s.weightKg ?? '—'}</Text>
          <Text style={{ flex: 1, color: palette.ink, fontSize: 15, fontWeight: '600' }}>{s.reps ?? '—'}</Text>
          <View style={{ width: 40 }}>
            {s.isPr === 1 ? (
              <View style={{ alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: palette.money }}>
                <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 0.3 }}>PR</Text>
              </View>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}
