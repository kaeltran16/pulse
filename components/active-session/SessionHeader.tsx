import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useActiveSessionStore } from '@/lib/state/activeSessionStore';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';
import { formatDuration, paceMinPerKm, formatPace } from '@/lib/workouts/cardio-aggregate';

export function SessionHeader({ onBack }: { onBack: () => void }) {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const phase = useActiveSessionStore((s) => s.phase);
  const mode = useActiveSessionStore((s) => s.mode);
  const routineNameSnapshot = useActiveSessionStore((s) => s.routineNameSnapshot);
  const startedAt = useActiveSessionStore((s) => s.startedAt);
  const exercises = useActiveSessionStore((s) => s.exercises);
  const currentExerciseIdx = useActiveSessionStore((s) => s.currentExerciseIdx);
  const setDrafts = useActiveSessionStore((s) => s.setDrafts);
  const finishSession = useActiveSessionStore((s) => s.finishSession);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsedSec = Math.max(0, Math.floor((now - startedAt) / 1000));
  const completedSets = setDrafts.length;
  const totalSets = exercises.reduce((s, e) => s + e.prescribedSets.length, 0);
  const totalVolume = setDrafts.reduce((s, d) => s + (d.reps ?? 0) * (d.weightKg ?? 0), 0);

  const cardioSet = mode === 'cardio' ? setDrafts[0] : undefined;
  const cardioDistance = cardioSet?.distanceKm ?? 0;
  const cardioPace = formatPace(paceMinPerKm(elapsedSec, cardioDistance));

  return (
    <View
      style={{
        backgroundColor: palette.move,
        paddingTop: 54,
        paddingBottom: 18,
        paddingHorizontal: 16,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable
          onPress={onBack}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: 'rgba(255,255,255,0.2)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 14 }}>▼</Text>
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text
            style={{
              fontSize: 10,
              fontWeight: '700',
              color: '#fff',
              opacity: 0.75,
              letterSpacing: 1.8,
            }}
          >
            ● {routineNameSnapshot.toUpperCase()}
          </Text>
          <Text style={{ fontSize: 32, fontWeight: '700', color: '#fff', marginTop: 2 }}>
            {formatDuration(elapsedSec)}
          </Text>
        </View>
        <Pressable
          onPress={finishSession}
          disabled={phase === 'finalizing'}
          style={{
            backgroundColor: '#fff',
            paddingHorizontal: 16,
            paddingVertical: 9,
            borderRadius: 100,
            opacity: phase === 'finalizing' ? 0.6 : 1,
          }}
        >
          <Text style={{ color: palette.move, fontSize: 13, fontWeight: '700' }}>
            {phase === 'finalizing' ? 'Saving…' : 'Finish'}
          </Text>
        </Pressable>
      </View>

      {mode === 'strength' && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 16 }}>
          {exercises.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === currentExerciseIdx ? 24 : 6,
                height: 4,
                borderRadius: 2,
                backgroundColor: i <= currentExerciseIdx ? '#fff' : 'rgba(255,255,255,0.3)',
              }}
            />
          ))}
        </View>
      )}

      <View
        style={{
          flexDirection: 'row',
          marginTop: 18,
          borderRadius: 12,
          overflow: 'hidden',
          backgroundColor: 'rgba(255,255,255,0.18)',
        }}
      >
        {mode === 'strength' ? (
          <>
            <Stat label="Exercise" value={`${currentExerciseIdx + 1}/${exercises.length}`} />
            <Stat label="Sets" value={`${completedSets}/${totalSets}`} />
            <Stat label="Volume" value={String(Math.round(totalVolume))} />
          </>
        ) : (
          <>
            <Stat label="Distance" value={`${cardioDistance.toFixed(2)} km`} />
            <Stat label="Pace" value={cardioPace} />
          </>
        )}
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, padding: 8, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.12)' }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>{value}</Text>
      <Text
        style={{
          fontSize: 9,
          fontWeight: '700',
          color: '#fff',
          opacity: 0.75,
          letterSpacing: 0.6,
          marginTop: 2,
        }}
      >
        {label.toUpperCase()}
      </Text>
    </View>
  );
}
