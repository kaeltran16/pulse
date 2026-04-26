import { Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export function GenerateHero() {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const moveTinted = resolved === 'light' ? 'rgba(52,199,89,0.18)' : 'rgba(48,209,88,0.20)';
  const accentTinted = resolved === 'light' ? 'rgba(0,122,255,0.14)' : 'rgba(10,132,255,0.18)';

  return (
    <View
      style={{
        backgroundColor: palette.ink,
        borderRadius: 20,
        padding: 20,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -50,
          right: -30,
          width: 160,
          height: 160,
          borderRadius: 9999,
          backgroundColor: moveTinted,
          opacity: 0.6,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: -40,
          left: 40,
          width: 120,
          height: 120,
          borderRadius: 9999,
          backgroundColor: accentTinted,
          opacity: 0.5,
        }}
      />

      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: palette.move,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SymbolView name={'sparkles' as never} size={12} tintColor="#fff" />
          </View>
          <Text
            style={{
              color: '#fff',
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              opacity: 0.85,
            }}
          >
            Pal builds your routine
          </Text>
        </View>
        <Text
          style={{
            color: '#fff',
            fontSize: 22,
            fontWeight: '700',
            letterSpacing: -0.4,
            lineHeight: 26,
            marginBottom: 6,
          }}
        >
          Describe what you want.{'\n'}Pal picks the exercises.
        </Text>
        <Text
          style={{
            color: '#fff',
            fontSize: 13,
            opacity: 0.75,
            letterSpacing: -0.1,
            lineHeight: 19,
          }}
        >
          "A 30-min pull day I can do at the gym" or "legs at home with dumbbells."
        </Text>
      </View>
    </View>
  );
}
