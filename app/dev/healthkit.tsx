import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import {
  requestPermissions,
  writeWorkout,
  useLiveHeartRate,
} from '@/lib/health';

type LogEntry = { ts: Date; msg: string };

export default function HealthKitDevScreen() {
  const [log, setLog] = useState<LogEntry[]>([]);
  const hr = useLiveHeartRate();

  const append = (msg: string) =>
    setLog((prev) => [{ ts: new Date(), msg }, ...prev].slice(0, 20));

  const onRequestPerms = async () => {
    try {
      const { granted } = await requestPermissions();
      append(`requestPermissions → granted=${granted}`);
    } catch (e) {
      append(`requestPermissions THREW: ${String(e)}`);
    }
  };

  const onWrite = async () => {
    const start = new Date(Date.now() - 5 * 60 * 1000);
    const end = new Date();
    try {
      await writeWorkout({
        activityType: 'traditionalStrengthTraining',
        start,
        end,
      });
      append(`writeWorkout OK — 5min strength @ ${end.toISOString()}`);
    } catch (e) {
      append(`writeWorkout THREW: ${String(e)}`);
    }
  };

  return (
    <ScrollView className="flex-1 bg-black p-6">
      <Text className="text-white text-2xl mb-4">HealthKit Dev</Text>

      <View className="gap-3 mb-6">
        <Pressable
          onPress={onRequestPerms}
          className="bg-blue-600 rounded-lg p-4"
        >
          <Text className="text-white text-center">Request permissions</Text>
        </Pressable>

        <Pressable
          onPress={onWrite}
          className="bg-green-700 rounded-lg p-4"
        >
          <Text className="text-white text-center">
            Write 5-min strength workout
          </Text>
        </Pressable>

        <Pressable
          onPress={hr.isStreaming ? hr.stop : hr.start}
          className="bg-red-700 rounded-lg p-4"
        >
          <Text className="text-white text-center">
            {hr.isStreaming ? 'Stop HR' : 'Start HR'}
          </Text>
        </Pressable>

        <Text className="text-white text-lg">
          HR: {hr.current ? `${hr.current.bpm.toFixed(0)} bpm` : '—'}
        </Text>
      </View>

      <Text className="text-white text-lg mb-2">Log</Text>
      {log.map((e, i) => (
        <Text key={i} className="text-white text-xs mb-1">
          {e.ts.toLocaleTimeString()} {e.msg}
        </Text>
      ))}
    </ScrollView>
  );
}
