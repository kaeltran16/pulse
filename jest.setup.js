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
