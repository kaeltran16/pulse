import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { db } from '@/lib/db/client';
import {
  getSession,
  getWeeklyVolumeSeries,
  type SessionFull,
} from '@/lib/db/queries/sessions';
import type { WeeklyVolumeBucket } from '@/lib/workouts/post-session-aggregate';
import { formatDuration, formatPace, paceMinPerKm } from '@/lib/workouts/cardio-aggregate';
import { formatRelativeDate } from '@/lib/workouts/date-format';
import { StatTile } from '@/components/workout-detail/StatTile';
import { WeeklyVolumeChart } from '@/components/workout-detail/WeeklyVolumeChart';
import { ExerciseTable } from '@/components/workout-detail/ExerciseTable';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export default function WorkoutDetail() {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  const [session, setSession] = useState<SessionFull | null>(null);
  const [series, setSeries] = useState<WeeklyVolumeBucket[]>([]);

  useEffect(() => {
    const id = Number(sessionId);
    if (!Number.isFinite(id)) return;
    (async () => {
      const s = await getSession(db, id);
      setSession(s);
      try {
        const out = await getWeeklyVolumeSeries(db, 8, Date.now());
        setSeries(out);
      } catch {
        setSeries([]);
      }
    })();
  }, [sessionId]);

  if (!session) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: palette.ink3, fontSize: 15 }}>Couldn&apos;t load this workout.</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16, padding: 12, borderRadius: 10, backgroundColor: palette.fill }}>
          <Text style={{ color: palette.accent, fontWeight: '600' }}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const subtitle = formatRelativeDate(session.finishedAt ?? Date.now(), Date.now());

  const tiles = session.mode === 'cardio'
    ? [
        { label: 'Duration', value: formatDuration(session.durationSeconds), unit: '', tint: palette.move },
        { label: 'Distance', value: session.sets[0]?.distanceKm != null ? session.sets[0].distanceKm.toFixed(1) : '—', unit: 'km', tint: palette.accent },
        { label: 'Pace', value: formatPace(paceMinPerKm(session.durationSeconds, session.sets[0]?.distanceKm ?? 0)), unit: '/km', tint: palette.rituals },
        { label: 'Avg HR', value: '—', unit: '', tint: palette.money },
      ]
    : [
        { label: 'Duration', value: String(Math.round(session.durationSeconds / 60)), unit: 'min', tint: palette.move },
        { label: 'Volume', value: (session.totalVolumeKg / 1000).toFixed(1), unit: 'tonnes', tint: palette.accent },
        { label: 'Sets', value: String(session.sets.length), unit: `${session.sets.reduce((s, x) => s + (x.reps ?? 0), 0)} reps`, tint: palette.rituals },
        { label: 'PRs', value: String(session.prCount), unit: 'new best', tint: palette.money },
      ];

  const byExercise = new Map<number, typeof session.sets>();
  for (const s of session.sets) {
    const list = byExercise.get(s.exercisePosition) ?? [];
    list.push(s);
    byExercise.set(s.exercisePosition, list);
  }
  const exercisePositions = Array.from(byExercise.keys()).sort((a, b) => a - b);

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={{ paddingTop: 56, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: palette.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={() => router.back()}>
              <Text style={{ fontSize: 17, color: palette.accent }}>{'< Back'}</Text>
            </Pressable>
          </View>
          <Text style={{ color: palette.ink, fontSize: 24, fontWeight: '700', marginTop: 8 }}>
            {session.routineNameSnapshot}
          </Text>
          <Text style={{ color: palette.ink3, fontSize: 13, marginTop: 2 }}>{subtitle}</Text>
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: 4 }}>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <StatTile {...tiles[0]} />
            <StatTile {...tiles[1]} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <StatTile {...tiles[2]} />
            <StatTile {...tiles[3]} />
          </View>
        </View>

        {session.mode === 'strength' && series.length > 0 && (
          <WeeklyVolumeChart series={series} />
        )}

        <View style={{ marginTop: 18 }}>
          <Text style={{ marginHorizontal: 20, marginBottom: 6, color: palette.ink3, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Exercises · {exercisePositions.length}
          </Text>
          {exercisePositions.length === 0 ? (
            <Text style={{ marginHorizontal: 20, color: palette.ink3, fontSize: 13 }}>No exercises logged.</Text>
          ) : (
            exercisePositions.map((pos) => {
              const sets = byExercise.get(pos)!;
              const exerciseId = sets[0].exerciseId;
              const name = session.exerciseMetaById[exerciseId]?.name ?? exerciseId;
              return <ExerciseTable key={pos} exerciseName={name} sets={sets} />;
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}
