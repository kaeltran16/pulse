import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { eq } from 'drizzle-orm';

import { DevSeedButton } from '@/components/DevSeedButton';
import { Fab } from '@/components/Fab';
import { RingTriad } from '@/components/RingTriad';
import { StatBlock } from '@/components/StatBlock';
import { db } from '@/lib/db/client';
import {
  goals,
  rituals,
  spendingEntries,
  movementEntries,
  ritualEntries,
} from '@/lib/db/schema';
import { getTodayAggregates } from '@/lib/db/queries/today';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function dollars(cents: number) {
  return `$${Math.round(cents / 100)}`;
}

export default function TodayTab() {
  const goalsQuery       = useLiveQuery(db.select().from(goals).where(eq(goals.id, 1)));
  const activeRitualsQuery = useLiveQuery(
    db.select().from(rituals).where(eq(rituals.active, true)),
  );
  const spendingQuery   = useLiveQuery(db.select().from(spendingEntries));
  const movementQuery   = useLiveQuery(db.select().from(movementEntries));
  const ritualEntriesQuery = useLiveQuery(db.select().from(ritualEntries));

  const goalsRow      = goalsQuery.data[0];
  const activeRituals = activeRitualsQuery.data;

  const aggregates = useMemo(() => {
    if (!goalsRow) return null;
    return getTodayAggregates({
      asOf: new Date(),
      goals: {
        dailyBudgetCents: goalsRow.dailyBudgetCents,
        dailyMoveMinutes: goalsRow.dailyMoveMinutes,
        dailyRitualTarget: goalsRow.dailyRitualTarget,
      },
      activeRituals,
      spending: spendingQuery.data,
      movement: movementQuery.data,
      ritualEntries: ritualEntriesQuery.data,
    });
  }, [
    goalsRow,
    activeRituals,
    spendingQuery.data,
    movementQuery.data,
    ritualEntriesQuery.data,
  ]);

  if (!goalsRow || !aggregates) {
    return <View className="flex-1 bg-bg" />;
  }

  const today = new Date();
  const datePill = `${WEEKDAYS[today.getDay()]} · ${MONTHS[today.getMonth()]} ${today.getDate()}`;

  const moneyP   = aggregates.spentCents   / Math.max(goalsRow.dailyBudgetCents, 1);
  const moveP    = aggregates.moveMinutes  / Math.max(goalsRow.dailyMoveMinutes, 1);
  const ritualsP = aggregates.activeRitualCount === 0
    ? 0
    : aggregates.ritualsDone / aggregates.activeRitualCount;

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-1">
        <DevSeedButton />
        <View className="px-6 pt-4">
          <Text className="text-caption1 text-ink3">{datePill}</Text>
          <Text className="text-largeTitle text-ink mt-1">Today</Text>
        </View>
        <View className="items-center mt-6">
          <RingTriad money={moneyP} move={moveP} rituals={ritualsP} size={240} />
        </View>
        <View className="flex-row mt-10 px-4">
          <StatBlock
            label="MONEY"
            value={dollars(aggregates.spentCents)}
            goal={`/ ${dollars(goalsRow.dailyBudgetCents)}`}
            toneClass="text-money"
          />
          <StatBlock
            label="MOVE"
            value={`${aggregates.moveMinutes}`}
            goal={`/ ${goalsRow.dailyMoveMinutes} MIN`}
            toneClass="text-move"
          />
          <StatBlock
            label="RITUALS"
            value={`${aggregates.ritualsDone}`}
            goal={`/ ${aggregates.activeRitualCount}`}
            toneClass="text-rituals"
          />
        </View>
        <Fab onPress={() => console.log('Log entry — SP3b')} />
      </View>
    </SafeAreaView>
  );
}
