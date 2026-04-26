import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { db } from '@/lib/db/client';
import { getRecentSessions, type SessionRowData } from '@/lib/db/queries/sessions';
import { SessionRow } from './SessionRow';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export function RecentSection() {
  const router = useRouter();
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const [rows, setRows] = useState<SessionRowData[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    const result = await getRecentSessions(db, 5);
    setRows(result);
    setNow(Date.now());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (rows.length === 0) return null;

  return (
    <View style={{ marginBottom: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: palette.ink3, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Recent
        </Text>
        <Pressable onPress={() => router.push('/(tabs)/move/history' as never)}>
          <Text style={{ fontSize: 13, color: palette.accent, fontWeight: '600' }}>See all</Text>
        </Pressable>
      </View>
      <View style={{ borderRadius: 12, overflow: 'hidden', backgroundColor: palette.surface }}>
        {rows.map((row) => (
          <SessionRow key={row.id} row={row} now={now} />
        ))}
      </View>
    </View>
  );
}
