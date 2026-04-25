import { Text, View } from 'react-native';

interface StatBlockProps {
  label: string;
  value: string;
  goal: string;
  toneClass: string; // e.g. "text-money"
}

export function StatBlock({ label, value, goal, toneClass }: StatBlockProps) {
  return (
    <View className="flex-1 items-center">
      <Text className={`text-caption2 ${toneClass}`}>{label}</Text>
      <Text className="text-title3 text-ink mt-1" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      <Text className="text-caption1 text-ink3 mt-0.5">{goal}</Text>
    </View>
  );
}
