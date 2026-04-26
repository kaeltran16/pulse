import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { db } from '@/lib/db/client';
import { getSession, type SessionFull } from '@/lib/db/queries/sessions';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';
import { formatDuration } from '@/lib/workouts/cardio-aggregate';

export default function PostWorkout() {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [session, setSession] = useState<SessionFull | null>(null);

  useEffect(() => {
    const id = Number(sessionId);
    if (!Number.isFinite(id)) return;
    getSession(db, id).then(setSession);
  }, [sessionId]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg, padding: 24, gap: 18 }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{ marginTop: 60, gap: 6 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: palette.move, letterSpacing: 1.2 }}>
          ✓ COMPLETE
        </Text>
        <Text style={{ fontSize: 28, fontWeight: '700', color: palette.ink }}>
          {session?.routineNameSnapshot ?? 'Saved'}
        </Text>
      </View>

      {session && (
        <View style={{ gap: 8, marginTop: 12 }}>
          <Row label="Session" value={`#${session.id}`} palette={palette} />
          <Row label="Sets" value={String(session.sets.length)} palette={palette} />
          <Row label="Total volume" value={`${Math.round(session.totalVolumeKg)} kg`} palette={palette} />
          <Row label="Duration" value={formatDuration(session.durationSeconds)} palette={palette} />
          <Row label="PRs" value={String(session.prCount)} palette={palette} />
        </View>
      )}

      <View style={{ flex: 1 }} />

      <Pressable
        onPress={() => router.replace('/(tabs)/move')}
        style={{ padding: 16, borderRadius: 12, backgroundColor: palette.move, alignItems: 'center' }}
      >
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Done</Text>
      </Pressable>
    </View>
  );
}

function Row({
  label,
  value,
  palette,
}: {
  label: string;
  value: string;
  palette: (typeof colors)[keyof typeof colors];
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 0.5,
        borderColor: palette.hair,
      }}
    >
      <Text style={{ color: palette.ink3, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: palette.ink, fontSize: 14, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}
