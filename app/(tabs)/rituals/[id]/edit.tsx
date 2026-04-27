import { useLocalSearchParams } from 'expo-router';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { eq } from 'drizzle-orm';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import RitualForm from '@/components/RitualForm';
import { db } from '@/lib/db/client';
import { rituals } from '@/lib/db/schema';
import type { RitualCadence, RitualColor, RitualIcon } from '@/lib/api-types';

export default function EditRitualScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const live = useLiveQuery(db.select().from(rituals).where(eq(rituals.id, id)));
  const row = live.data[0];

  if (!row) {
    return (
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-1 items-center justify-center">
          <Text className="text-callout text-ink3">Ritual not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <RitualForm
      mode="edit"
      id={id}
      initial={{
        title: row.title,
        icon: row.icon as RitualIcon,
        cadence: row.cadence as RitualCadence,
        color: row.color as RitualColor,
      }}
    />
  );
}
