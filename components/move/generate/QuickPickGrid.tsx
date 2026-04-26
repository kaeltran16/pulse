import { Pressable, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export interface QuickPickGridProps {
  onPick: (label: string) => void;
  loading: boolean;
}

type Tone = 'move' | 'accent' | 'rituals' | 'money' | 'red' | 'orange';

interface Goal {
  id: string;
  label: string;
  sf: string;
  tone: Tone;
}

const GOALS: Goal[] = [
  { id: 'push-strength',    label: '45-min push for strength',    sf: 'flame.fill',           tone: 'move' },
  { id: 'full-body',        label: 'Quick full-body, no barbell', sf: 'figure.mixed.cardio',  tone: 'accent' },
  { id: 'pull-hypertrophy', label: 'Pull day focused on back',    sf: 'figure.pullup',        tone: 'rituals' },
  { id: 'cardio-hiit',      label: 'Short HIIT cardio',           sf: 'bolt.fill',            tone: 'money' },
  { id: 'legs-posterior',   label: 'Legs — glutes and hams',      sf: 'figure.walk',          tone: 'orange' },
  { id: 'home-nothing',     label: 'Home workout, no gear',       sf: 'house.fill',           tone: 'red' },
];

function toneColor(tone: Tone, palette: typeof colors.light | typeof colors.dark): string {
  switch (tone) {
    case 'move':    return palette.move;
    case 'accent':  return palette.accent;
    case 'rituals': return palette.rituals;
    case 'money':   return palette.money;
    case 'red':     return palette.red;
    case 'orange':  return '#FF9500';
  }
}

function toneTint(c: string): string {
  // 0x1a (~10%) overlay, matches handoff `${c}1a` pattern.
  return c + '1a';
}

export function QuickPickGrid({ onPick, loading }: QuickPickGridProps) {
  const { resolved } = useTheme();
  const palette = colors[resolved];

  return (
    <View>
      <Text
        style={{
          fontSize: 12,
          fontWeight: '700',
          color: palette.ink3,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          paddingHorizontal: 4,
          paddingBottom: 10,
        }}
      >
        Or try one of these
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {GOALS.map((g) => {
          const c = toneColor(g.tone, palette);
          return (
            <Pressable
              key={g.id}
              onPress={() => onPick(g.label)}
              disabled={loading}
              style={{
                width: '48%',
                backgroundColor: palette.surface,
                borderRadius: 14,
                padding: 12,
                borderWidth: 0.5,
                borderColor: palette.hair,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                opacity: loading ? 0.4 : 1,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  backgroundColor: toneTint(c),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <SymbolView name={g.sf as never} size={15} tintColor={c} />
              </View>
              <Text
                style={{
                  flex: 1,
                  fontSize: 13,
                  fontWeight: '500',
                  color: palette.ink,
                  letterSpacing: -0.1,
                  lineHeight: 16,
                }}
              >
                {g.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
