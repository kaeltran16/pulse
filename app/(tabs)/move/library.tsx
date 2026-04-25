import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { db } from '@/lib/db/client';
import { exercises as exercisesTbl, type Exercise } from '@/lib/db/schema';
import { useEditorStore } from '@/lib/state/editorStore';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

const GROUPS = ['All', 'Push', 'Pull', 'Legs', 'Core', 'Cardio'] as const;

export default function ExerciseLibrary() {
  const router = useRouter();
  const params = useLocalSearchParams<{ pick?: string }>();
  const isPicker = params.pick === '1';
  const { resolved } = useTheme();
  const palette = colors[resolved];

  const [filter, setFilter] = useState<(typeof GROUPS)[number]>('All');
  const [all, setAll] = useState<Exercise[]>([]);
  const [detail, setDetail] = useState<Exercise | null>(null);
  const addExercise = useEditorStore((s) => s.addExercise);

  useEffect(() => {
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = await (db as any).select().from(exercisesTbl) as Exercise[];
      setAll(rows);
    })();
  }, []);

  const filtered = filter === 'All' ? all : all.filter((e) => e.group === filter);

  const onTap = (ex: Exercise) => {
    if (isPicker) {
      addExercise(ex.id);
      router.back();
    } else {
      setDetail(ex);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: palette.accent, fontSize: 17 }}>{isPicker ? 'Cancel' : 'Back'}</Text>
        </Pressable>
        <Text style={{ color: palette.ink, fontSize: 17, fontWeight: '600' }}>
          {isPicker ? 'Pick exercise' : 'Library'}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {GROUPS.map((g) => (
          <Pressable
            key={g}
            onPress={() => setFilter(g)}
            style={{
              paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100,
              backgroundColor: g === filter ? palette.accent : palette.fill,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: g === filter ? '#fff' : palette.ink2 }}>{g}</Text>
          </Pressable>
        ))}
      </View>

      {filtered.map((ex) => (
        <Pressable
          key={ex.id}
          onPress={() => onTap(ex)}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 10,
            paddingVertical: 12, paddingHorizontal: 12,
            borderBottomWidth: 0.5, borderBottomColor: palette.hair,
          }}
        >
          <View style={{ width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: `${palette.move}22` }}>
            <SymbolView name={ex.sfSymbol as never} size={16} tintColor={palette.move} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '500', color: palette.ink }}>{ex.name}</Text>
            <Text style={{ fontSize: 12, color: palette.ink3 }}>{ex.muscle} · {ex.equipment}</Text>
          </View>
        </Pressable>
      ))}

      {detail && (
        <View style={{
          position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <View style={{ backgroundColor: palette.surface, padding: 16, borderRadius: 12, width: '85%' }}>
            <Text style={{ fontSize: 17, fontWeight: '600', color: palette.ink }}>{detail.name}</Text>
            <Text style={{ fontSize: 13, color: palette.ink3, marginTop: 4 }}>
              {detail.group} · {detail.muscle} · {detail.equipment}
            </Text>
            <Pressable onPress={() => setDetail(null)} style={{ marginTop: 16, alignItems: 'center' }}>
              <Text style={{ color: palette.accent, fontWeight: '600' }}>Close</Text>
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
