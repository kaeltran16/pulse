import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

const ALL_TAGS = ['Upper', 'Lower', 'Full', 'Cardio', 'Custom'] as const;
export type Tag = (typeof ALL_TAGS)[number];

export function TagPills({
  value, onChange, disabledTags = [],
}: {
  value: string;
  onChange: (t: string) => void;
  disabledTags?: string[];
}) {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {ALL_TAGS.map((t) => {
        const selected = t === value;
        const disabled = disabledTags.includes(t);
        return (
          <Pressable
            key={t}
            disabled={disabled}
            onPress={() => onChange(t)}
            style={{
              paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100,
              backgroundColor: selected ? palette.accent : palette.fill,
              opacity: disabled ? 0.4 : 1,
            }}
          >
            <Text style={{
              fontSize: 12, fontWeight: '600',
              color: selected ? '#fff' : palette.ink2,
            }}>{t}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
