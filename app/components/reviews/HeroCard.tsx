import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useTheme } from '@/lib/theme/provider';
import { colors, type } from '@/lib/theme/tokens';

type Props = {
  hero: string;
  onRegenerate: () => void;
  busy?: boolean;
  cooldownMs?: number;
};

const COOLDOWN_MS = 60_000;

export function HeroCard({ hero, onRegenerate, busy, cooldownMs = COOLDOWN_MS }: Props) {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const [lastFiredAt, setLastFiredAt] = useState<number | null>(null);
  const onCooldown = lastFiredAt !== null && Date.now() - lastFiredAt < cooldownMs;
  const disabled = !!busy || onCooldown;

  const handlePress = () => {
    if (disabled) return;
    setLastFiredAt(Date.now());
    onRegenerate();
  };

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 20,
        borderRadius: 16,
        backgroundColor: palette.accentTint,
        borderWidth: 0.5,
        borderColor: palette.accent + '33',
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: '600', color: palette.accent, marginBottom: 8, letterSpacing: 0.3 }}>
        ✦ WRITTEN BY PAL
      </Text>
      <Text style={{ ...type.body, color: palette.ink, lineHeight: 22 }}>{hero}</Text>
      <Pressable
        onPress={handlePress}
        disabled={disabled}
        accessibilityState={{ disabled }}
        accessibilityLabel="Regenerate review"
        style={{
          alignSelf: 'flex-start',
          marginTop: 12,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: palette.surface,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {busy ? (
          <ActivityIndicator size="small" />
        ) : (
          <Text style={{ ...type.caption1, color: palette.ink2 }}>
            {onCooldown ? 'Just regenerated…' : 'Regenerate'}
          </Text>
        )}
      </Pressable>
    </View>
  );
}
