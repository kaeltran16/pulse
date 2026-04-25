import { View } from 'react-native';

import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

import { Ring } from './Ring';

export interface RingTriadProps {
  money: number;   // 0..1+ (clamp inside)
  move: number;
  rituals: number;
  size?: number;
}

export function RingTriad({ money, move, rituals, size = 240 }: RingTriadProps) {
  const { resolved } = useTheme();
  const palette = colors[resolved];

  const stroke = Math.round(size * 0.085);
  const gap = stroke + 4;
  const moveSize = size - 2 * gap;
  const ritualSize = moveSize - 2 * gap;

  return (
    <View style={{ width: size, height: size }}>
      <View style={{ position: 'absolute' }}>
        <Ring
          size={size}
          strokeWidth={stroke}
          progress={Math.min(money, 1)}
          color={palette.money}
          trackColor={palette.fill}
        />
      </View>
      <View style={{ position: 'absolute', top: gap, left: gap }}>
        <Ring
          size={moveSize}
          strokeWidth={stroke}
          progress={Math.min(move, 1)}
          color={palette.move}
          trackColor={palette.fill}
        />
      </View>
      <View style={{ position: 'absolute', top: gap * 2, left: gap * 2 }}>
        <Ring
          size={ritualSize}
          strokeWidth={stroke}
          progress={Math.min(rituals, 1)}
          color={palette.rituals}
          trackColor={palette.fill}
        />
      </View>
    </View>
  );
}
