import { Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export interface ResultHeroProps {
  routine: {
    name: string;
    tag: string;
    estMin: number;
    rationale: string;
    exerciseCount: number;
  };
}

export function ResultHero({ routine }: ResultHeroProps) {
  const { resolved } = useTheme();
  const palette = colors[resolved];

  return (
    <View
      style={{
        backgroundColor: palette.move,
        borderRadius: 20,
        padding: 18,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Faux gradient: a translucent accent overlay from top-right */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '70%',
          height: '100%',
          backgroundColor: palette.accent,
          opacity: 0.35,
        }}
      />

      <View>
        <View
          style={{
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingHorizontal: 9,
            paddingVertical: 3,
            backgroundColor: 'rgba(255,255,255,0.2)',
            borderRadius: 100,
            marginBottom: 8,
          }}
        >
          <SymbolView name={'sparkles' as never} size={9} tintColor="#fff" />
          <Text
            style={{
              color: '#fff',
              fontSize: 10,
              fontWeight: '700',
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            Generated
          </Text>
        </View>
        <Text
          style={{
            color: '#fff',
            fontSize: 24,
            fontWeight: '700',
            letterSpacing: -0.5,
            lineHeight: 27,
          }}
        >
          {routine.name}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' }}>
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 2,
              backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: 100,
            }}
          >
            <Text
              style={{
                color: '#fff',
                fontSize: 11,
                fontWeight: '600',
                letterSpacing: -0.08,
              }}
            >
              {routine.tag}
            </Text>
          </View>
          <Text style={{ color: '#fff', fontSize: 12, opacity: 0.85, letterSpacing: -0.08 }}>
            {routine.exerciseCount} exercises · ~{routine.estMin} min
          </Text>
        </View>
        {routine.rationale ? (
          <View
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTopWidth: 0.5,
              borderTopColor: 'rgba(255,255,255,0.2)',
            }}
          >
            <Text
              style={{
                color: '#fff',
                fontSize: 13,
                opacity: 0.9,
                letterSpacing: -0.1,
                lineHeight: 19,
              }}
            >
              {routine.rationale}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
