import { Pressable, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export interface ResultActionsProps {
  onTryAgain: () => void;
  onSave: () => void;
  saving: boolean;
}

export function ResultActions({ onTryAgain, onSave, saving }: ResultActionsProps) {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 16,
        paddingTop: 8,
      }}
    >
      <Pressable
        onPress={onTryAgain}
        disabled={saving}
        style={{
          flex: 1,
          paddingVertical: 13,
          backgroundColor: palette.surface,
          borderWidth: 0.5,
          borderColor: palette.hair,
          borderRadius: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5,
          opacity: saving ? 0.5 : 1,
        }}
      >
        <SymbolView name={'arrow.clockwise' as never} size={12} tintColor={palette.ink2} />
        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: palette.ink2,
            letterSpacing: -0.2,
          }}
        >
          Try again
        </Text>
      </Pressable>
      <Pressable
        onPress={onSave}
        disabled={saving}
        style={{
          flex: 2,
          paddingVertical: 13,
          backgroundColor: palette.move,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: saving ? 0.7 : 1,
        }}
      >
        <Text
          style={{
            fontSize: 15,
            fontWeight: '700',
            color: '#fff',
            letterSpacing: -0.24,
          }}
        >
          {saving ? 'Saving…' : 'Save routine'}
        </Text>
      </Pressable>
    </View>
  );
}
