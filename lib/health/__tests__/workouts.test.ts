/** @jest-environment node */

const mockSaveWorkoutSample = jest.fn().mockResolvedValue(undefined);

jest.mock('@kingstinct/react-native-healthkit', () => ({
  __esModule: true,
  saveWorkoutSample: (...args: unknown[]) => mockSaveWorkoutSample(...args),
  WorkoutActivityType: {
    traditionalStrengthTraining: 1,
    running: 2,
    rowing: 3,
    other: 0,
  },
}));

import { writeWorkout } from '../workouts';

const start = new Date('2026-04-26T10:00:00Z');
const end   = new Date('2026-04-26T10:47:00Z');

describe('writeWorkout', () => {
  beforeEach(() => {
    mockSaveWorkoutSample.mockClear();
  });

  it('passes empty samples for strength sessions (no distance)', async () => {
    await writeWorkout({ activityType: 'traditionalStrengthTraining', start, end });
    expect(mockSaveWorkoutSample).toHaveBeenCalledTimes(1);
    const [, samples, callStart, callEnd] = mockSaveWorkoutSample.mock.calls[0];
    expect(samples).toEqual([]);
    expect(callStart).toBe(start);
    expect(callEnd).toBe(end);
  });

  it('passes one distance sample for cardio sessions when distanceKm provided', async () => {
    await writeWorkout({ activityType: 'running', start, end, distanceKm: 3.5 });
    expect(mockSaveWorkoutSample).toHaveBeenCalledTimes(1);
    const [, samples] = mockSaveWorkoutSample.mock.calls[0];
    expect(samples).toHaveLength(1);
    expect(samples[0]).toMatchObject({ value: 3.5, unit: 'km' });
  });

  it('omits distance sample when distanceKm is undefined', async () => {
    await writeWorkout({ activityType: 'running', start, end });
    const [, samples] = mockSaveWorkoutSample.mock.calls[0];
    expect(samples).toEqual([]);
  });

  it('omits distance sample when distanceKm is 0 or negative (defensive)', async () => {
    await writeWorkout({ activityType: 'running', start, end, distanceKm: 0 });
    const [, samples] = mockSaveWorkoutSample.mock.calls[0];
    expect(samples).toEqual([]);
  });
});
