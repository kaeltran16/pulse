import { useState } from 'react';
import { useMostRecentQuantitySample } from '@kingstinct/react-native-healthkit';
import type { HRSample } from './types';

export function useLiveHeartRate(): {
  current: HRSample | null;
  isStreaming: boolean;
  start: () => void;
  stop: () => void;
} {
  const [isStreaming, setStreaming] = useState(false);

  const sample = useMostRecentQuantitySample('HKQuantityTypeIdentifierHeartRate');

  const current: HRSample | null =
    isStreaming && sample
      ? { bpm: sample.quantity, sampledAt: sample.endDate }
      : null;

  return {
    current,
    isStreaming,
    start: () => setStreaming(true),
    stop: () => setStreaming(false),
  };
}
