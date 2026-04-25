import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export default function GenerateStub() {
  const router = useRouter();
  const { resolved } = useTheme();
  const palette = colors[resolved];
  return (
    <View style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: palette.ink, marginBottom: 8 }}>Generate routine</Text>
      <Text style={{ fontSize: 15, color: palette.ink3, textAlign: 'center' }}>
        AI routine generation arrives in SP4f.
      </Text>
      <Pressable onPress={() => router.back()} style={{ marginTop: 24, padding: 12 }}>
        <Text style={{ color: palette.accent, fontWeight: '600' }}>Back</Text>
      </Pressable>
    </View>
  );
}
