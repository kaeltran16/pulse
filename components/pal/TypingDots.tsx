import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

export function TypingDots() {
  const [n, setN] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setN((v) => (v % 3) + 1), 400);
    return () => clearInterval(t);
  }, []);
  return (
    <View className="flex-row gap-1 px-3 py-2">
      {[0, 1, 2].map((i) => (
        <View key={i} className={i < n ? 'h-1.5 w-1.5 rounded-full bg-ink3' : 'h-1.5 w-1.5 rounded-full bg-fill'} />
      ))}
      <Text className="sr-only">Pal is typing</Text>
    </View>
  );
}
