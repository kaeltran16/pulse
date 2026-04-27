import * as Notifications from 'expo-notifications';

const REMINDER_ID = 'pulse-daily-rituals';

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

export async function ensurePermission(): Promise<PermissionStatus> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return 'granted';
  const { status } = await Notifications.requestPermissionsAsync();
  return status as PermissionStatus;
}

export async function scheduleDailyReminder(timeMinutes: number, body: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
  const hour = Math.floor(timeMinutes / 60);
  const minute = timeMinutes % 60;
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: { title: 'Pulse', body, sound: 'default' },
    trigger: {
      type: 'daily' as const,
      hour,
      minute,
      // Expo SDK trigger shape; equivalent to a repeating calendar trigger.
    } as Notifications.NotificationTriggerInput,
  });
}

export async function cancelDailyReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
}

export function reminderBody(activeRituals: Array<{ title: string }>): string {
  const n = activeRituals.length;
  if (n === 0) return 'Open Pulse — your rituals await.';
  if (n === 1) return `${activeRituals[0].title} waiting.`;
  if (n <= 3) return `${activeRituals.map((r) => r.title).join(', ')} waiting.`;
  return `${n} rituals waiting today.`;
}
