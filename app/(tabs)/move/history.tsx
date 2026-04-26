import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';

import { db } from '@/lib/db/client';
import { listAllSessions, type SessionRowData } from '@/lib/db/queries/sessions';
import { SessionRow } from '@/components/history/SessionRow';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

type Filter = 'all' | 'strength' | 'cardio';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'strength', label: 'Strength' },
  { id: 'cardio', label: 'Cardio' },
];

export default function History() {
  const router = useRouter();
  const { resolved } = useTheme();
  const palette = colors[resolved];

  const [filter, setFilter] = useState<Filter>('all');
  const [rows, setRows] = useState<SessionRowData[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    const out = await listAllSessions(db, filter === 'all' ? undefined : filter);
    setRows(out);
    setNow(Date.now());
  }, [filter]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  useEffect(() => { refresh(); }, [refresh]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ paddingTop: 56, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 0.5, borderColor: palette.hair }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Pressable onPress={() => router.back()}>
            <Text style={{ fontSize: 17, color: palette.accent }}>{'< Back'}</Text>
          </Pressable>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: palette.ink }}>History</Text>
            <Text style={{ fontSize: 12, color: palette.ink3 }}>{rows.length} workouts</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {FILTERS.map((f) => {
            const selected = f.id === filter;
            return (
              <Pressable
                key={f.id}
                onPress={() => setFilter(f.id)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 100,
                  backgroundColor: selected ? palette.ink : palette.surface,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: selected ? palette.bg : palette.ink }}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {rows.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Text style={{ fontSize: 15, color: palette.ink3, textAlign: 'center' }}>
            No workouts yet. Start one above.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <SessionRow row={item} now={now} />}
          contentContainerStyle={{ paddingVertical: 8 }}
        />
      )}
    </View>
  );
}
