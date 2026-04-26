import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { SetCard, type SetCardState } from './SetCard';
import { SetEditSheet } from './SetEditSheet';
import { LiveHRChip } from './LiveHRChip';
import { useActiveSessionStore, type ExerciseInSession } from '@/lib/state/activeSessionStore';
import { wouldThisSetBeAPR } from '@/lib/workouts/in-flight-pr';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export function ExerciseCard({
  exerciseIdx,
  exercise,
}: {
  exerciseIdx: number;
  exercise: ExerciseInSession;
}) {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const setDrafts = useActiveSessionStore((s) => s.setDrafts);
  const prSnapshot = useActiveSessionStore((s) => s.prSnapshot);
  const completeSet = useActiveSessionStore((s) => s.completeSet);
  const editSet = useActiveSessionStore((s) => s.editSet);
  const removeSet = useActiveSessionStore((s) => s.removeSet);
  const addSetToCurrent = useActiveSessionStore((s) => s.addSetToCurrent);
  const skipExercise = useActiveSessionStore((s) => s.skipExercise);

  const loggedAtThis = setDrafts.filter((d) => d.exercisePosition === exerciseIdx);
  const prescribed = exercise.prescribedSets;

  const cards: { state: SetCardState; setPos: number }[] = [];
  const firstActiveIdx = prescribed.findIndex(
    (_, j) => !loggedAtThis.some((d) => d.setPosition === j),
  );
  for (let i = 0; i < prescribed.length; i++) {
    const logged = loggedAtThis.find((d) => d.setPosition === i);
    if (logged) {
      const isPr = wouldThisSetBeAPR(prSnapshot, exercise.exerciseId, logged.reps, logged.weightKg);
      cards.push({
        state: { kind: 'done', reps: logged.reps ?? 0, weightKg: logged.weightKg ?? 0, isPr },
        setPos: i,
      });
    } else if (i === firstActiveIdx) {
      cards.push({
        state: {
          kind: 'active',
          targetReps: prescribed[i].reps,
          targetWeightKg: prescribed[i].weightKg,
          reps: prescribed[i].reps,
          weightKg: prescribed[i].weightKg,
        },
        setPos: i,
      });
    } else {
      cards.push({
        state: {
          kind: 'upcoming',
          targetReps: prescribed[i].reps,
          targetWeightKg: prescribed[i].weightKg,
        },
        setPos: i,
      });
    }
  }

  const [editing, setEditing] = useState<{ setPos: number; reps: number; weightKg: number } | null>(null);
  const [activeDraft, setActiveDraft] = useState<{
    setPos: number;
    reps: number | null;
    weightKg: number | null;
  } | null>(null);

  const onComplete = (setPos: number, reps: number | null, weightKg: number | null) => {
    if (reps === null || weightKg === null) return;
    completeSet(exerciseIdx, setPos, { reps, weightKg, durationSeconds: null, distanceKm: null });
    setActiveDraft(null);
  };

  return (
    <View
      style={{
        padding: 18,
        borderRadius: 18,
        backgroundColor: palette.surface,
        borderWidth: 0.5,
        borderColor: palette.hair,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: palette.move, letterSpacing: 1.2 }}>
            ● NOW · EXERCISE {exerciseIdx + 1}
          </Text>
          <Text style={{ fontSize: 22, fontWeight: '700', color: palette.ink, marginTop: 2 }}>
            {exercise.meta.name}
          </Text>
          <Text style={{ fontSize: 12, color: palette.ink3, marginTop: 4 }}>
            {exercise.meta.muscle} · {exercise.meta.equipment}
          </Text>
        </View>
        <LiveHRChip />
        <Pressable
          onPress={() =>
            Alert.alert(exercise.meta.name, undefined, [
              { text: 'Skip exercise', onPress: skipExercise },
              { text: 'Cancel', style: 'cancel' },
            ])
          }
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: palette.fill,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: palette.ink2, fontSize: 16 }}>⋯</Text>
        </Pressable>
      </View>

      <View style={{ gap: 8 }}>
        {cards.map(({ state, setPos }) => (
          <View key={setPos}>
            {state.kind === 'active' ? (
              <SetCard
                num={setPos + 1}
                state={{
                  ...state,
                  reps: activeDraft?.setPos === setPos ? activeDraft.reps : state.reps,
                  weightKg: activeDraft?.setPos === setPos ? activeDraft.weightKg : state.weightKg,
                }}
                onChange={(patch) =>
                  setActiveDraft({
                    setPos,
                    reps: 'reps' in patch ? (patch.reps ?? null) : (activeDraft?.reps ?? state.reps),
                    weightKg:
                      'weightKg' in patch
                        ? (patch.weightKg ?? null)
                        : (activeDraft?.weightKg ?? state.weightKg),
                  })
                }
                onComplete={() =>
                  onComplete(
                    setPos,
                    activeDraft?.setPos === setPos ? activeDraft.reps : state.reps,
                    activeDraft?.setPos === setPos ? activeDraft.weightKg : state.weightKg,
                  )
                }
              />
            ) : state.kind === 'done' ? (
              <SetCard
                num={setPos + 1}
                state={state}
                onTapDone={() => setEditing({ setPos, reps: state.reps, weightKg: state.weightKg })}
              />
            ) : (
              <SetCard num={setPos + 1} state={state} />
            )}
          </View>
        ))}
      </View>

      <Pressable
        onPress={addSetToCurrent}
        style={{
          marginTop: 10,
          padding: 12,
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: palette.hair,
          borderStyle: 'dashed',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: palette.ink3, fontWeight: '600' }}>+ Add set</Text>
      </Pressable>

      <SetEditSheet
        visible={editing !== null}
        initialReps={editing?.reps ?? 0}
        initialWeightKg={editing?.weightKg ?? 0}
        onCancel={() => setEditing(null)}
        onSave={(patch) => {
          if (editing) {
            editSet(exerciseIdx, editing.setPos, { ...patch, durationSeconds: null, distanceKm: null });
          }
          setEditing(null);
        }}
        onRemove={() => {
          if (editing) {
            removeSet(exerciseIdx, editing.setPos);
          }
          setEditing(null);
        }}
      />
    </View>
  );
}
