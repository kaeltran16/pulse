// Stub the HealthKit native module for all suites. The library requires
// react-native-nitro-modules which can't load in node, so any code path that
// transitively imports `lib/health/workouts.ts` (now reached via finalizeSession)
// would otherwise crash before tests run.
jest.mock('@kingstinct/react-native-healthkit', () => ({
  __esModule: true,
  saveWorkoutSample: jest.fn().mockResolvedValue(undefined),
  requestAuthorization: jest.fn().mockResolvedValue(true),
  WorkoutActivityType: {
    traditionalStrengthTraining: 1,
    running: 2,
    rowing: 3,
    other: 0,
  },
}));

// Stub expo-live-activity so any code path that imports lib/live-activity (or
// transitively reaches it via activeSessionStore) doesn't crash in node.
jest.mock('expo-live-activity', () => ({
  __esModule: true,
  startActivity: jest.fn().mockReturnValue('mock-activity-id'),
  updateActivity: jest.fn(),
  stopActivity: jest.fn(),
}));
