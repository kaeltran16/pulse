import { Canvas, Path, Skia, BlurMask } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { useDerivedValue, useSharedValue, withTiming, Easing } from 'react-native-reanimated';

interface RingProps {
  size: number;
  strokeWidth: number;
  /** 0..1 (clamped). Values > 1 still render as a full ring in SP3a. */
  progress: number;
  color: string;
  trackColor: string;
}

export function Ring({ size, strokeWidth, progress, color, trackColor }: RingProps) {
  const target = Math.max(0, Math.min(1, progress));
  const animated = useSharedValue(target);

  useEffect(() => {
    animated.value = withTiming(target, { duration: 400, easing: Easing.inOut(Easing.ease) });
  }, [target, animated]);

  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth) / 2;

  // Background track
  const trackPath = Skia.Path.Make();
  trackPath.addCircle(cx, cy, r);

  // Progress arc
  const sweepPath = useDerivedValue(() => {
    const p = Skia.Path.Make();
    const sweep = Math.PI * 2 * animated.value;
    p.addArc(
      { x: cx - r, y: cy - r, width: r * 2, height: r * 2 },
      -90, // start at 12 o'clock
      (sweep * 180) / Math.PI,
    );
    return p;
  });

  return (
    <Canvas style={{ width: size, height: size }}>
      <Path
        path={trackPath}
        color={trackColor}
        style="stroke"
        strokeWidth={strokeWidth}
        strokeCap="round"
      />
      <Path
        path={sweepPath}
        color={color}
        style="stroke"
        strokeWidth={strokeWidth}
        strokeCap="round"
      >
        <BlurMask blur={0} style="solid" />
      </Path>
    </Canvas>
  );
}
