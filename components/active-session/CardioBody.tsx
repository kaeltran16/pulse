import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { useActiveSessionStore } from '@/lib/state/activeSessionStore';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';
import { formatDuration, paceMinPerKm, formatPace } from '@/lib/workouts/cardio-aggregate';

export function CardioBody() {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const exercises = useActiveSessionStore((s) => s.exercises);
  const startedAt = useActiveSessionStore((s) => s.startedAt);
  const setDrafts = useActiveSessionStore((s) => s.setDrafts);
  const completeSet = useActiveSessionStore((s) => s.completeSet);

  const exercise = exercises[0];
  const target = exercise?.prescribedSets[0];

  const draft = setDrafts[0];
  const [distance, setDistance] = useState(
    draft?.distanceKm !== undefined && draft?.distanceKm !== null
      ? String(draft.distanceKm)
      : target?.distanceKm !== null && target?.distanceKm !== undefined
        ? String(target.distanceKm)
        : '',
  );

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsedSec = Math.max(0, Math.floor((now - startedAt) / 1000));
  const distanceNum = Number(distance);
  const validDistance = !Number.isNaN(distanceNum) && distanceNum > 0;

  const persist = () => {
    if (!exercise) return;
    completeSet(0, 0, {
      reps: null,
      weightKg: null,
      durationSeconds: null,
      distanceKm: validDistance ? distanceNum : null,
    });
  };

  if (!exercise) return null;

  return (
    <View style={{ padding: 18 }}>
      <View
        style={{
          padding: 22,
          borderRadius: 18,
          backgroundColor: palette.surface,
          borderWidth: 0.5,
          borderColor: palette.hair,
          alignItems: 'center',
          gap: 16,
        }}
      >
        <Text style={{ fontSize: 11, fontWeight: '700', color: palette.ink3, letterSpacing: 1.2 }}>
          {exercise.meta.name.toUpperCase()}
        </Text>
        <Text
          style={{
            fontSize: 56,
            fontWeight: '700',
            color: palette.ink,
            fontVariant: ['tabular-nums'],
          }}
        >
          {formatDuration(elapsedSec)}
        </Text>
        {target?.durationSeconds != null && (
          <Text style={{ fontSize: 13, color: palette.ink3 }}>
            Target: {formatDuration(target.durationSeconds)}
          </Text>
        )}

        <View
          style={{
            marginTop: 8,
            alignSelf: 'stretch',
            padding: 14,
            borderRadius: 12,
            backgroundColor: palette.fill,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '700', color: palette.ink3, letterSpacing: 0.8 }}>
            DISTANCE (km)
          </Text>
          <TextInput
            keyboardType="decimal-pad"
            value={distance}
            onChangeText={setDistance}
            onBlur={persist}
            style={{ fontSize: 36, fontWeight: '700', color: palette.ink, marginTop: 4 }}
          />
          {target?.distanceKm != null && (
            <Text style={{ fontSize: 11, color: palette.ink3, marginTop: 4 }}>
              Target: {target.distanceKm} km
            </Text>
          )}
        </View>

        {validDistance && (
          <Text style={{ fontSize: 13, color: palette.ink2 }}>
            Pace: {formatPace(paceMinPerKm(elapsedSec, distanceNum))} /km
          </Text>
        )}
      </View>
    </View>
  );
}
