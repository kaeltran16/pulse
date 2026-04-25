import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { db } from '@/lib/db/client';
import { listRoutines, createEmptyRoutine, type RoutineSummary } from '@/lib/db/queries/routines';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';
import { RoutineCard } from '@/components/workouts/RoutineCard';
import { CardioRow } from '@/components/workouts/CardioRow';
import { RoutineActionSheet } from '@/components/workouts/RoutineActionSheet';
import { RenameRoutineSheet } from '@/components/workouts/RenameRoutineSheet';
import { useRoutineActions } from '@/lib/hooks/useRoutineActions';

export default function PreWorkout() {
  const router = useRouter();
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const actions = useRoutineActions();

  const [routines, setRoutines] = useState<RoutineSummary[]>([]);
  const refresh = useCallback(async () => {
    const rows = await listRoutines(db);
    setRoutines(rows);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const [actionTarget, setActionTarget] = useState<RoutineSummary | null>(null);
  const [renameTarget, setRenameTarget] = useState<RoutineSummary | null>(null);

  const strength = routines.filter((r) => r.tag !== 'Cardio');
  const cardio = routines.filter((r) => r.tag === 'Cardio');

  const onNew = async () => {
    const id = await createEmptyRoutine(db, { name: 'New routine', tag: 'Custom' });
    router.push({ pathname: '/(tabs)/move/[routineId]/edit', params: { routineId: String(id) } });
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Text style={{ fontSize: 28, fontWeight: '700', color: palette.ink }}>Workouts</Text>
        <Pressable onPress={onNew}>
          <Text style={{ fontSize: 17, color: palette.accent, fontWeight: '600' }}>+ New</Text>
        </Pressable>
      </View>

      <Text style={{ fontSize: 12, fontWeight: '700', color: palette.ink3, textTransform: 'uppercase', marginBottom: 8 }}>
        Strength
      </Text>
      {strength.map((r) => (
        <RoutineCard
          key={r.id}
          routine={r}
          onPress={() => router.push({ pathname: '/(tabs)/move/[routineId]/edit', params: { routineId: String(r.id) } })}
          onLongPress={() => setActionTarget(r)}
        />
      ))}

      {cardio.length > 0 && (
        <>
          <Text style={{ fontSize: 12, fontWeight: '700', color: palette.ink3, textTransform: 'uppercase', marginVertical: 12 }}>
            Cardio
          </Text>
          {cardio.map((r) => (
            <CardioRow
              key={r.id}
              routine={r}
              onPress={() => { /* SP4d: start cardio session. No-op in 4c. */ }}
            />
          ))}
        </>
      )}

      <View style={{ marginTop: 24, gap: 8 }}>
        <Pressable
          onPress={() => router.push('/(tabs)/move/library')}
          style={{ padding: 14, borderRadius: 12, backgroundColor: palette.surface, borderColor: palette.hair, borderWidth: 0.5, alignItems: 'center' }}
        >
          <Text style={{ color: palette.accent, fontWeight: '600' }}>Browse exercise library</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/(tabs)/move/generate')}
          style={{ padding: 14, borderRadius: 12, backgroundColor: palette.accent, alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Generate routine with AI</Text>
        </Pressable>
      </View>

      <RoutineActionSheet
        visible={actionTarget !== null}
        onClose={() => setActionTarget(null)}
        onDuplicate={async () => {
          if (actionTarget) {
            await actions.duplicate(actionTarget.id);
            await refresh();
          }
        }}
        onRename={() => { setRenameTarget(actionTarget); setActionTarget(null); }}
        onDelete={async () => {
          if (actionTarget) {
            await actions.delete(actionTarget.id, actionTarget.name);
            await refresh();
          }
        }}
      />
      <RenameRoutineSheet
        visible={renameTarget !== null}
        initialName={renameTarget?.name ?? ''}
        onCancel={() => setRenameTarget(null)}
        onSave={async (name) => {
          if (renameTarget) {
            await actions.rename(renameTarget.id, name);
            await refresh();
          }
          setRenameTarget(null);
        }}
      />
    </ScrollView>
  );
}
