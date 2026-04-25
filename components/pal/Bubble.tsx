import { Text, View } from 'react-native';

export function Bubble({ role, text }: { role: 'user' | 'assistant'; text: string }) {
  const isUser = role === 'user';
  return (
    <View className={isUser ? 'self-end mb-2 max-w-[76%]' : 'self-start mb-2 max-w-[76%]'}>
      <View
        className={
          isUser
            ? 'px-3 py-2 rounded-2xl rounded-br-md bg-accent'
            : 'px-3 py-2 rounded-2xl rounded-bl-md bg-fill'
        }
      >
        <Text className={isUser ? 'text-body text-white' : 'text-body text-ink'}>{text}</Text>
      </View>
    </View>
  );
}
