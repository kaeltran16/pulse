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
  await saveWorkoutSample(ACTIVITY_TYPE_ID[p.activityType], [], p.start, p.end);
}
