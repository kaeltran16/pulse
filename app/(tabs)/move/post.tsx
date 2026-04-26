import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { db } from '@/lib/db/client';
import { getSession, type SessionFull } from '@/lib/db/queries/sessions';
import {
  computeMuscleDistribution,
  selectTopPRs,
  type MuscleDistribution,
} from '@/lib/workouts/post-session-aggregate';
import { CompleteHero } from '@/components/post-workout/CompleteHero';
import { PrHighlightCard } from '@/components/post-workout/PrHighlightCard';
import { MuscleBars } from '@/components/post-workout/MuscleBars';
import { ExerciseRecapCard } from '@/components/post-workout/ExerciseRecapCard';
import { CardioRecapCard } from '@/components/post-workout/CardioRecapCard';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';
import { formatDuration, formatPace, paceMinPerKm } from '@/lib/workouts/cardio-aggregate';

export default function PostWorkout() {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId: string; healthSyncFailed?: string }>();
  const healthSyncFailed = params.healthSyncFailed === '1';

  const [session, setSession] = useState<SessionFull | null>(null);

  useEffect(() => {
    const id = Number(params.sessionId);
    if (!Number.isFinite(id)) return;
    getSession(db, id).then(setSession);
  }, [params.sessionId]);

  const distribution = useMemo<MuscleDistribution[]>(() => {
    if (!session) return [];
    return computeMuscleDistribution(session.sets, session.exerciseMetaById);
  }, [session]);

  const topPRs = useMemo(() => {
    if (!session) return { top: [], more: 0 };
    const prInputs = session.sets
      .filter((s) => s.isPr === 1 && s.weightKg != null && s.reps != null)
      .map((s) => ({
        exerciseId: s.exerciseId,
        weightKg: s.weightKg as number,
        reps: s.reps as number,
      }));
    return selectTopPRs(prInputs, session.exerciseMetaById, 2);
  }, [session]);

  if (!session) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: palette.ink3, fontSize: 15 }}>Couldn&apos;t load this workout.</Text>
        <Pressable onPress={() => router.replace('/(tabs)/move')} style={{ marginTop: 16, padding: 12, borderRadius: 10, backgroundColor: palette.fill }}>
          <Text style={{ color: palette.accent, fontWeight: '600' }}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const totalReps = session.sets.reduce((sum, s) => sum + (s.reps ?? 0), 0);

  let subline: string;
  if (session.mode === 'cardio') {
    subline = session.routineNameSnapshot;
  } else if (session.prCount > 0 && topPRs.top[0]) {
    subline = `You hit a new PR on ${topPRs.top[0].exerciseName}`;
  } else {
    subline = `${Math.round(session.durationSeconds / 60)} minutes well spent`;
  }

  const cells = session.mode === 'cardio'
    ? [
        { label: 'Time', value: formatDuration(session.durationSeconds), unit: '' },
        { label: 'Distance', value: session.sets[0]?.distanceKm != null ? session.sets[0].distanceKm.toFixed(1) : '—', unit: 'km' },
        { label: 'Pace', value: formatPace(paceMinPerKm(session.durationSeconds, session.sets[0]?.distanceKm ?? 0)), unit: '/km' },
      ]
    : [
        { label: 'Time', value: String(Math.round(session.durationSeconds / 60)), unit: 'min' },
        { label: 'Volume', value: (session.totalVolumeKg / 1000).toFixed(1), unit: 'tonnes' },
        { label: 'Sets', value: String(session.sets.length), unit: `${totalReps} reps` },
        { label: 'PRs', value: String(session.prCount), unit: 'records' },
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
        <CompleteHero headline="Nice session." subline={subline} cells={cells} />

        {session.mode === 'strength' && topPRs.top.map((pr, idx) => {
          const moreSuffix =
            idx === topPRs.top.length - 1 && topPRs.more > 0
              ? `+${topPRs.more} more PRs unlocked`
              : undefined;
          return <PrHighlightCard key={pr.exerciseId} pr={pr} moreSuffix={moreSuffix} />;
        })}

        {session.mode === 'strength' && <MuscleBars distribution={distribution} />}

        {session.mode === 'cardio' && session.sets[0] && (
          <CardioRecapCard
            exerciseName={session.exerciseMetaById[session.sets[0].exerciseId]?.name ?? session.routineNameSnapshot}
            durationSeconds={session.durationSeconds}
            distanceKm={session.sets[0].distanceKm}
          />
        )}

        {session.mode === 'strength' && exercisePositions.length > 0 && (
          <View style={{ marginTop: 18 }}>
            <Text style={{ marginHorizontal: 20, marginBottom: 6, color: palette.ink3, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Exercises · {exercisePositions.length}
            </Text>
            {exercisePositions.map((pos) => {
              const sets = byExercise.get(pos)!;
              const exerciseId = sets[0].exerciseId;
              const name = session.exerciseMetaById[exerciseId]?.name ?? exerciseId;
              return <ExerciseRecapCard key={pos} exerciseName={name} sets={sets} />;
            })}
          </View>
        )}

        {healthSyncFailed && (
          <Text style={{ marginHorizontal: 20, marginTop: 16, color: palette.ink3, fontSize: 12 }}>
            Couldn&apos;t sync to Health.app — your workout is saved locally.
          </Text>
        )}

        <Pressable
          onPress={() => router.replace('/(tabs)/move')}
          style={{ marginHorizontal: 20, marginTop: 18, padding: 16, borderRadius: 12, backgroundColor: palette.move, alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Done</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
