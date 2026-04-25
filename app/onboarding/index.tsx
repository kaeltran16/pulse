import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { db } from '@/lib/db/client';
import { finishOnboarding } from '@/lib/db/queries/onboarding';
import { DEFAULT_RITUALS } from '@/lib/db/seed-defaults';

const BUDGET_CHIPS_DOLLARS = [50, 85, 120, 200];
const BUDGET_DEFAULT = 85;
const MOVE_CHIPS_MIN = [20, 45, 60, 90];
const MOVE_DEFAULT = 60;

type StepKey = 0 | 1 | 2 | 3;

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState<StepKey>(0);
  const [budget, setBudget] = useState(BUDGET_DEFAULT);
  const [moveGoal, setMoveGoal] = useState(MOVE_DEFAULT);
  const [activeTitles, setActiveTitles] = useState<string[]>(
    DEFAULT_RITUALS.map((r) => r.title),
  );
  const [busy, setBusy] = useState(false);

  const ritualToggle = (title: string) => {
    setActiveTitles((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title],
    );
  };

  const advance = () => {
    if (step < 3) setStep((step + 1) as StepKey);
    else void commit();
  };

  const skip = () => {
    if (step === 1) setBudget(BUDGET_DEFAULT);
    if (step === 2) setMoveGoal(MOVE_DEFAULT);
    if (step === 3) setActiveTitles(DEFAULT_RITUALS.map((r) => r.title));
    if (step < 3) setStep((step + 1) as StepKey);
    else void commit();
  };

  const commit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // Preserve display order from DEFAULT_RITUALS for active titles.
      const ordered = DEFAULT_RITUALS.map((r) => r.title).filter((t) =>
        activeTitles.includes(t),
      );
      await finishOnboarding(db, {
        dailyBudgetCents: budget * 100,
        dailyMoveMinutes: moveGoal,
        activeRitualTitles: ordered,
      });
      router.replace('/(tabs)/today');
    } finally {
      setBusy(false);
    }
  };

  const ritualCount = activeTitles.length;
  const canAdvance = step !== 3 || ritualCount > 0;

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView className="flex-1" contentContainerClassName="px-6 pb-12 pt-8">
        <ProgressDots step={step} total={4} />
        {step === 0 && <WelcomeStep />}
        {step === 1 && (
          <BudgetStep value={budget} onChange={setBudget} />
        )}
        {step === 2 && (
          <MoveStep value={moveGoal} onChange={setMoveGoal} />
        )}
        {step === 3 && (
          <RitualsStep activeTitles={activeTitles} onToggle={ritualToggle} />
        )}
      </ScrollView>
      <View className="px-6 pb-8">
        <Pressable
          accessibilityRole="button"
          disabled={!canAdvance || busy}
          onPress={advance}
          className={
            canAdvance && !busy
              ? 'bg-accent rounded-2xl py-4 items-center'
              : 'bg-fill rounded-2xl py-4 items-center'
          }
        >
          <Text className="text-headline text-white">
            {step === 0 ? 'Get started' : step === 3 ? 'Start tracking' : 'Continue'}
          </Text>
        </Pressable>
        {step > 0 && (
          <Pressable onPress={skip} className="mt-3 items-center py-2">
            <Text className="text-subhead text-ink3">Skip</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <View className="flex-row justify-center gap-1.5 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          className={
            i === step
              ? 'h-1.5 w-5 rounded-full bg-accent'
              : 'h-1.5 w-1.5 rounded-full bg-fill'
          }
        />
      ))}
    </View>
  );
}

function WelcomeStep() {
  return (
    <View className="items-center mt-8">
      <Hero glyph="✦" tone="accent" />
      <Text className="mt-6 text-largeTitle text-ink text-center">
        Welcome to{'\n'}Pulse
      </Text>
      <Text className="mt-3 text-body text-ink3 text-center px-4">
        One app for money, movement, and the little rituals that hold your day together.
      </Text>
    </View>
  );
}

function BudgetStep({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View className="items-center mt-8">
      <Hero glyph="$" tone="money" />
      <Text className="mt-6 text-largeTitle text-ink text-center">Set a daily{'\n'}budget</Text>
      <Text className="mt-3 text-body text-ink3 text-center">
        We&apos;ll help you stay under it — gently.
      </Text>
      <Text className="mt-6 text-largeTitle text-ink">${value}</Text>
      <ChipRow
        items={BUDGET_CHIPS_DOLLARS.map((n) => ({ label: `$${n}`, value: n }))}
        selected={value}
        onSelect={onChange}
        tone="money"
      />
    </View>
  );
}

function MoveStep({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View className="items-center mt-8">
      <Hero glyph="◐" tone="move" />
      <Text className="mt-6 text-largeTitle text-ink text-center">Pick a{'\n'}move goal</Text>
      <Text className="mt-3 text-body text-ink3 text-center">
        Any kind of movement counts — run, walk, yoga, anything.
      </Text>
      <Text className="mt-6 text-largeTitle text-ink">{value} MIN</Text>
      <ChipRow
        items={MOVE_CHIPS_MIN.map((n) => ({ label: `${n} min`, value: n }))}
        selected={value}
        onSelect={onChange}
        tone="move"
      />
    </View>
  );
}

function RitualsStep({
  activeTitles,
  onToggle,
}: {
  activeTitles: string[];
  onToggle: (title: string) => void;
}) {
  return (
    <View className="mt-8">
      <View className="items-center">
        <Hero glyph="✧" tone="rituals" />
        <Text className="mt-6 text-largeTitle text-ink text-center">
          Choose your{'\n'}rituals
        </Text>
        <Text className="mt-3 text-body text-ink3 text-center px-4">
          Five small things you want to do each day. You can edit these anytime.
        </Text>
      </View>
      <View className="mt-8 bg-surface rounded-2xl overflow-hidden">
        {DEFAULT_RITUALS.map((r, i) => {
          const on = activeTitles.includes(r.title);
          return (
            <Pressable
              key={r.title}
              onPress={() => onToggle(r.title)}
              accessibilityRole="switch"
              accessibilityState={{ checked: on }}
              className={
                'flex-row items-center px-4 py-3 ' +
                (i < DEFAULT_RITUALS.length - 1 ? 'border-b border-hair' : '')
              }
            >
              <View className="h-7 w-7 rounded-md bg-rituals mr-3" />
              <Text className="flex-1 text-callout text-ink">{r.title}</Text>
              <View
                className={
                  on
                    ? 'h-6 w-10 rounded-full bg-move items-end justify-center pr-0.5'
                    : 'h-6 w-10 rounded-full bg-fill items-start justify-center pl-0.5'
                }
              >
                <View className="h-5 w-5 rounded-full bg-white" />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Hero({ glyph, tone }: { glyph: string; tone: 'accent' | 'money' | 'move' | 'rituals' }) {
  const tintBg = {
    accent: 'bg-accentTint',
    money: 'bg-moneyTint',
    move: 'bg-moveTint',
    rituals: 'bg-ritualsTint',
  }[tone];
  const fg = {
    accent: 'text-accent',
    money: 'text-money',
    move: 'text-move',
    rituals: 'text-rituals',
  }[tone];
  return (
    <View className={`h-24 w-24 rounded-3xl items-center justify-center ${tintBg}`}>
      <Text className={`text-title1 ${fg}`}>{glyph}</Text>
    </View>
  );
}

function ChipRow<T>({
  items,
  selected,
  onSelect,
  tone,
}: {
  items: { label: string; value: T }[];
  selected: T;
  onSelect: (v: T) => void;
  tone: 'money' | 'move';
}) {
  const onClass = tone === 'money' ? 'bg-money' : 'bg-move';
  return (
    <View className="flex-row gap-2 mt-6 flex-wrap justify-center">
      {items.map((item) => {
        const isSel = item.value === selected;
        return (
          <Pressable
            key={item.label}
            onPress={() => onSelect(item.value)}
            className={
              isSel
                ? `${onClass} px-4 py-2.5 rounded-full`
                : 'bg-surface border border-hair px-4 py-2.5 rounded-full'
            }
          >
            <Text className={isSel ? 'text-subhead text-white' : 'text-subhead text-ink'}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
