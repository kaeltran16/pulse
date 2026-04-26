import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useActiveSessionStore } from '@/lib/state/activeSessionStore';
import { remainingMs, isOvertime } from '@/lib/workouts/rest-timer';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';
import { formatDuration } from '@/lib/workouts/cardio-aggregate';

export function RestBanner() {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const rest = useActiveSessionStore((s) => s.rest);
  const addRestTime = useActiveSessionStore((s) => s.addRestTime);
  const skipRest = useActiveSessionStore((s) => s.skipRest);
  const tickRest = useActiveSessionStore((s) => s.tickRest);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (rest.status !== 'running') return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      tickRest(t);
    }, 1000);
    return () => clearInterval(id);
  }, [rest.status, tickRest]);

  if (rest.status !== 'running') return null;

  const remSec = Math.ceil(remainingMs(rest, now) / 1000);
  const overtime = isOvertime(rest, now);
  const display = overtime ? "Rest's up" : formatDuration(remSec);

  return (
    <View
      style={{
        backgroundColor: palette.accent,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <View>
        <Text
          style={{
            fontSize: 10,
            fontWeight: '700',
            color: '#fff',
            opacity: 0.85,
            letterSpacing: 1,
          }}
        >
          REST
        </Text>
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#fff' }}>{display}</Text>
      </View>
      <View style={{ flex: 1 }} />
      <Pressable
        onPress={() => addRestTime(30)}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 7,
          borderRadius: 100,
          backgroundColor: 'rgba(255,255,255,0.22)',
        }}
      >
        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>+30s</Text>
      </Pressable>
      <Pressable
        onPress={skipRest}
        style={{
          paddingHorizontal: 14,
          paddingVertical: 7,
          borderRadius: 100,
          backgroundColor: '#fff',
        }}
      >
        <Text style={{ color: palette.accent, fontSize: 12, fontWeight: '700' }}>Skip</Text>
      </Pressable>
    </View>
  );
}
