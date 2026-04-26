import {
  saveWorkoutSample,
  WorkoutActivityType,
} from '@kingstinct/react-native-healthkit';
import type { HKActivityType, WorkoutWritePayload } from './types';

const ACTIVITY_TYPE_ID: Record<HKActivityType, WorkoutActivityType> = {
  traditionalStrengthTraining: WorkoutActivityType.traditionalStrengthTraining,
  running: WorkoutActivityType.running,
  rowing: WorkoutActivityType.rowing,
  other: WorkoutActivityType.other,
};

export async function writeWorkout(p: WorkoutWritePayload): Promise<void> {
  const samples =
    p.distanceKm !== undefined && p.distanceKm > 0
      ? [
          {
            quantityType: 'HKQuantityTypeIdentifierDistanceWalkingRunning' as const,
            quantity: p.distanceKm,
            unit: 'km',
            startDate: p.start,
            endDate: p.end,
          },
        ]
      : [];
  await saveWorkoutSample(ACTIVITY_TYPE_ID[p.activityType], samples, p.start, p.end);
}
