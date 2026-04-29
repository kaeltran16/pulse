import { View, Text, Pressable } from 'react-native';
import { useTheme } from '@/lib/theme/provider';
import { colors, type } from '@/lib/theme/tokens';

type Props = {
  markdown: string;
  askPalPrompt: string;
  onAskPal: (prompt: string) => void;
};

function parseInlineBold(input: string): Array<{ text: string; bold: boolean }> {
  const parts: Array<{ text: string; bold: boolean }> = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(input))) {
    if (m.index > lastIndex) parts.push({ text: input.slice(lastIndex, m.index), bold: false });
    parts.push({ text: m[1], bold: true });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < input.length) parts.push({ text: input.slice(lastIndex), bold: false });
  return parts;
}

export function OneThingToTry({ markdown, askPalPrompt, onAskPal }: Props) {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const segments = parseInlineBold(markdown);

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
      <Text style={{ fontSize: 11, fontWeight: '600', color: palette.ink3, marginBottom: 8, letterSpacing: 0.3 }}>
        ✦ ONE THING TO TRY
      </Text>
      <Text style={{ ...type.body, color: palette.ink, lineHeight: 22, marginBottom: 12 }}>
        {segments.map((s, i) =>
          s.bold ? (
            <Text key={i} style={{ fontWeight: '700' }}>{s.text}</Text>
          ) : (
            <Text key={i}>{s.text}</Text>
          ),
        )}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ask Pal more"
        onPress={() => onAskPal(askPalPrompt)}
        style={{
          alignSelf: 'flex-start',
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: palette.accent,
        }}
      >
        <Text style={{ ...type.subhead, color: '#fff', fontWeight: '600' }}>Ask Pal more</Text>
      </Pressable>
    </View>
  );
}
