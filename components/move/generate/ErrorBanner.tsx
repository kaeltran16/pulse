import { Text, View } from 'react-native';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export interface ErrorBannerProps {
  message: string;
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  return (
    <View
      style={{
        backgroundColor: palette.red + '12',
        borderWidth: 0.5,
        borderColor: palette.red + '44',
        borderRadius: 12,
        padding: 14,
      }}
    >
      <Text style={{ fontSize: 13, color: palette.red, letterSpacing: -0.1 }}>{message}</Text>
    </View>
  );
}
