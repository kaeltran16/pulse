import { requestAuthorization } from '@kingstinct/react-native-healthkit';

export async function requestPermissions(): Promise<{ granted: boolean }> {
  // iOS deliberately hides per-type grants; we treat "user responded to sheet"
  // as granted=true. Real failures surface as thrown errors at write/read time.
  try {
    const ok = await requestAuthorization({
      toShare: [
        'HKWorkoutTypeIdentifier',
        'HKQuantityTypeIdentifierDistanceWalkingRunning',
      ],
      toRead: ['HKQuantityTypeIdentifierHeartRate'],
    });
    return { granted: ok };
  } catch {
    return { granted: false };
  }
}
