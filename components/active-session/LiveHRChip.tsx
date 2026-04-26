import { useEffect } from 'react';
import { Text, View } from 'react-native';

import { useLiveHeartRate } from '@/lib/health/heart-rate';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

const STALE_MS = 30_000;

export function LiveHRChip() {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const { current, isStreaming, start, stop } = useLiveHeartRate();

  useEffect(() => {
    if (!isStreaming) start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!current) return null;
  const sampledAtMs =
    current.sampledAt instanceof Date ? current.sampledAt.getTime() : Number(current.sampledAt);
  if (Date.now() - sampledAtMs > STALE_MS) return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        backgroundColor: palette.fill,
      }}
    >
      <Text style={{ color: palette.move, fontSize: 11, fontWeight: '700' }}>♥</Text>
      <Text style={{ color: palette.ink, fontSize: 12, fontWeight: '600' }}>
        {Math.round(current.bpm)} bpm
      </Text>
    </View>
  );
}
