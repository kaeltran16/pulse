import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { db } from '@/lib/db/client';
import { getRoutineWithSets, updateRoutine, deleteRoutine, type DraftInput } from '@/lib/db/queries/routines';
import { useEditorStore } from '@/lib/state/editorStore';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';
import { ExerciseRow } from '@/components/workouts/ExerciseRow';
import { TagPills } from '@/components/workouts/TagPills';
import { ExerciseSettingsSheet } from '@/components/workouts/ExerciseSettingsSheet';
import { SetEditSheet } from '@/components/workouts/SetEditSheet';
import { exercises as exercisesTbl, type Exercise } from '@/lib/db/schema';

export default function RoutineEditor() {
  const router = useRouter();
  const { routineId } = useLocalSearchParams<{ routineId: string }>();
  const id = Number(routineId);
  const { resolved } = useTheme();
  const palette = colors[resolved];

  const { draft, isDirty, loadDraft, clearDraft, setName, setTag, setRestDefault,
          setWarmupReminder, setAutoProgress, removeExercise, setExerciseRest,
          addSet, updateSet } = useEditorStore();

  const [notFound, setNotFound] = useState(false);
  const [exerciseMeta, setExerciseMeta] = useState<Record<string, Exercise>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await getRoutineWithSets(db, id);
      if (cancelled) return;
      if (!r) { setNotFound(true); return; }
      loadDraft(r);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const all = await (db as any).select().from(exercisesTbl) as Exercise[];
      const map: Record<string, Exercise> = {};
      for (const ex of all) map[ex.id] = ex;
      setExerciseMeta(map);
    })();
    return () => { cancelled = true; clearDraft(); };
  }, [id, loadDraft, clearDraft]);

  const [exSettingsIdx, setExSettingsIdx] = useState<number | null>(null);
  const [setEdit, setSetEdit] = useState<{ exIdx: number; setIdx: number } | null>(null);

  if (notFound) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: palette.ink, fontSize: 17 }}>Routine not found</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16, padding: 12 }}>
          <Text style={{ color: palette.accent, fontWeight: '600' }}>Back</Text>
        </Pressable>
      </View>
    );
  }
  if (!draft) return <View style={{ flex: 1, backgroundColor: palette.bg }} />;

  const trimmedNameValid = draft.name.trim().length > 0;
  const canSave = isDirty && trimmedNameValid;

  const onCancel = () => {
    if (!isDirty) { router.back(); return; }
    Alert.alert('Discard changes?', 'You have unsaved edits.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { clearDraft(); router.back(); } },
    ]);
  };

  const onSave = async () => {
    const input: DraftInput = {
      routineId: draft.routineId,
      name: draft.name.trim(),
      tag: draft.tag,
      color: draft.color,
      position: draft.position,
      restDefaultSeconds: draft.restDefaultSeconds,
      warmupReminder: draft.warmupReminder,
      autoProgress: draft.autoProgress,
      exercises: draft.exercises.map((ex) => ({
        id: ex.id,
        exerciseId: ex.exerciseId,
        restSeconds: ex.restSeconds,
        sets: ex.sets.map((s) => ({
          id: s.id,
          targetReps: s.targetReps,
          targetWeightKg: s.targetWeightKg,
          targetDurationSeconds: s.targetDurationSeconds,
          targetDistanceKm: s.targetDistanceKm,
        })),
      })),
    };
    try {
      await updateRoutine(db, input);
      clearDraft();
      router.back();
    } catch (e) {
      Alert.alert("Couldn't save changes", String(e));
    }
  };

  const onDelete = () => {
    Alert.alert('Delete routine', `Delete "${draft.name}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteRoutine(db, draft.routineId);
            clearDraft();
            router.back();
          } catch (e) {
            Alert.alert("Couldn't delete routine", String(e));
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ paddingBottom: 80 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16 }}>
        <Pressable onPress={onCancel}>
          <Text style={{ color: palette.accent, fontSize: 17 }}>Cancel</Text>
        </Pressable>
        <Pressable onPress={onSave} disabled={!canSave}>
          <Text style={{ color: canSave ? palette.accent : palette.ink4, fontSize: 17, fontWeight: '600' }}>Save</Text>
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: palette.ink3, textTransform: 'uppercase', marginBottom: 4 }}>Name</Text>
        <TextInput
          value={draft.name}
          onChangeText={setName}
          style={{
            fontSize: 17, fontWeight: '500', color: palette.ink,
            borderBottomWidth: 0.5, borderBottomColor: trimmedNameValid ? palette.hair : palette.red,
            paddingVertical: 8, marginBottom: 12,
          }}
        />
        <Text style={{ fontSize: 11, fontWeight: '700', color: palette.ink3, textTransform: 'uppercase', marginBottom: 6 }}>Tag</Text>
        <TagPills value={draft.tag} onChange={setTag} disabledTags={['Cardio']} />
      </View>

      <Text style={{ fontSize: 11, fontWeight: '700', color: palette.ink3, textTransform: 'uppercase', padding: 16 }}>
        Exercises · {draft.exercises.length}
      </Text>
      {draft.exercises.map((ex, i) => {
        const meta = exerciseMeta[ex.exerciseId];
        return (
          <View key={`${ex.id}-${i}`} style={{ borderBottomWidth: 0.5, borderBottomColor: palette.hair }}>
            <ExerciseRow
              name={meta?.name ?? ex.exerciseId}
              muscle={meta?.muscle ?? ''}
              sfSymbol={meta?.sfSymbol ?? 'dumbbell.fill'}
              sets={ex.sets}
              onTapRow={() => setExSettingsIdx(i)}
              onTapSet={(setIdx) => setSetEdit({ exIdx: i, setIdx })}
              onAddSet={() => addSet(i)}
            />
            <Pressable onPress={() => removeExercise(i)} style={{ alignItems: 'flex-end', padding: 8 }}>
              <Text style={{ color: palette.red, fontSize: 12 }}>Remove</Text>
            </Pressable>
          </View>
        );
      })}

      <Pressable
        onPress={() => router.push('/(tabs)/move/library?pick=1')}
        style={{ margin: 16, padding: 14, borderRadius: 12, backgroundColor: palette.surface, borderColor: palette.hair, borderWidth: 0.5, alignItems: 'center' }}
      >
        <Text style={{ color: palette.accent, fontWeight: '600' }}>+ Add exercise from library</Text>
      </Pressable>

      <Pressable
        onPress={() => router.push('/(tabs)/move/generate')}
        style={{ marginHorizontal: 16, padding: 14, borderRadius: 12, backgroundColor: palette.accent, alignItems: 'center' }}
      >
        <Text style={{ color: '#fff', fontWeight: '700' }}>Generate routine with AI</Text>
      </Pressable>

      <Text style={{ fontSize: 11, fontWeight: '700', color: palette.ink3, textTransform: 'uppercase', padding: 16, marginTop: 16 }}>
        Session settings
      </Text>
      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: palette.ink, fontSize: 15 }}>Rest timer default (sec)</Text>
          <TextInput
            keyboardType="number-pad"
            value={String(draft.restDefaultSeconds)}
            onChangeText={(t) => setRestDefault(parseInt(t || '0', 10) || 0)}
            style={{
              borderWidth: 0.5, borderColor: palette.hair, borderRadius: 6,
              padding: 6, color: palette.ink, minWidth: 60, textAlign: 'right',
            }}
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: palette.ink, fontSize: 15 }}>Warm-up reminder</Text>
          <Switch value={draft.warmupReminder} onValueChange={setWarmupReminder} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: palette.ink, fontSize: 15 }}>Auto-progress weights</Text>
          <Switch value={draft.autoProgress} onValueChange={setAutoProgress} />
        </View>
      </View>

      <Pressable onPress={onDelete} style={{ marginTop: 24, padding: 13, alignItems: 'center' }}>
        <Text style={{ color: palette.red, fontSize: 15, fontWeight: '500' }}>Delete routine</Text>
      </Pressable>

      <ExerciseSettingsSheet
        visible={exSettingsIdx !== null}
        exerciseName={exSettingsIdx !== null ? (exerciseMeta[draft.exercises[exSettingsIdx].exerciseId]?.name ?? '') : ''}
        initialRest={exSettingsIdx !== null ? draft.exercises[exSettingsIdx].restSeconds : null}
        fallbackRest={draft.restDefaultSeconds}
        onCancel={() => setExSettingsIdx(null)}
        onSave={(r) => { if (exSettingsIdx !== null) setExerciseRest(exSettingsIdx, r); setExSettingsIdx(null); }}
      />
      <SetEditSheet
        visible={setEdit !== null}
        initialReps={setEdit ? draft.exercises[setEdit.exIdx].sets[setEdit.setIdx].targetReps : null}
        initialWeight={setEdit ? draft.exercises[setEdit.exIdx].sets[setEdit.setIdx].targetWeightKg : null}
        onCancel={() => setSetEdit(null)}
        onSave={(reps, weight) => {
          if (setEdit) updateSet(setEdit.exIdx, setEdit.setIdx, { targetReps: reps, targetWeightKg: weight });
          setSetEdit(null);
        }}
      />
    </ScrollView>
  );
}
