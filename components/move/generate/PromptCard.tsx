import { Pressable, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export interface PromptCardProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
}

export function PromptCard({ value, onChange, onSubmit, loading }: PromptCardProps) {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const canSubmit = value.trim().length > 0 && !loading;

  return (
    <View
      style={{
        backgroundColor: palette.surface,
        borderRadius: 16,
        padding: 14,
        borderWidth: 0.5,
        borderColor: palette.hair,
      }}
    >
      <TextInput
        value={value}
        onChangeText={onChange}
        editable={!loading}
        placeholder="What kind of workout do you want? Goal, duration, equipment…"
        placeholderTextColor={palette.ink4}
        multiline
        style={{
          minHeight: 76,
          fontSize: 15,
          color: palette.ink,
          letterSpacing: -0.2,
          lineHeight: 21,
          textAlignVertical: 'top',
        }}
      />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingTop: 10,
          borderTopWidth: 0.5,
          borderTopColor: palette.hair,
        }}
      >
        <Text
          style={{
            flex: 1,
            fontSize: 11,
            color: palette.ink4,
            letterSpacing: -0.08,
          }}
        >
          Pal picks from your exercise library
        </Text>
        <Pressable
          onPress={onSubmit}
          disabled={!canSubmit}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 9,
            borderRadius: 100,
            backgroundColor: canSubmit ? palette.move : palette.fill,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <SymbolView
            name={'sparkles' as never}
            size={11}
            tintColor={canSubmit ? '#fff' : palette.ink4}
          />
          <Text
            style={{
              fontSize: 13,
              fontWeight: '700',
              letterSpacing: -0.1,
              color: canSubmit ? '#fff' : palette.ink4,
            }}
          >
            {loading ? 'Thinking…' : 'Generate'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
