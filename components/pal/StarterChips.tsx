import { Pressable, Text, View } from 'react-native';

export type Starter = { label: string; tone: 'money' | 'move' | 'rituals' | 'accent' };

const STARTERS: Starter[] = [
  { label: 'Verve coffee, $5',      tone: 'money' },
  { label: 'Ran 30 minutes',         tone: 'move' },
  { label: "How's my week so far?",  tone: 'accent' },
];

export function StarterChips({ onPick }: { onPick: (text: string) => void }) {
  return (
    <View className="px-4 pb-3">
      <Text className="text-caption1 text-ink3 uppercase tracking-wider mb-2">Try saying</Text>
      <View className="gap-2">
        {STARTERS.map((s) => (
          <Pressable
            key={s.label}
            onPress={() => onPick(s.label)}
            className="flex-row items-center px-3 py-2.5 bg-surface border border-hair rounded-xl"
          >
            <View className={
              s.tone === 'money'  ? 'h-2 w-2 rounded-full bg-money mr-3'
              : s.tone === 'move' ? 'h-2 w-2 rounded-full bg-move mr-3'
              : s.tone === 'rituals' ? 'h-2 w-2 rounded-full bg-rituals mr-3'
              : 'h-2 w-2 rounded-full bg-accent mr-3'
            } />
            <Text className="flex-1 text-callout text-ink">{s.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
