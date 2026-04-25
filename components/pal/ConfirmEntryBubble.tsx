import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { ParseResponse } from '../../lib/api-types';

type Props = {
  entry: Extract<ParseResponse, { kind: 'spend' | 'workout' }>;
  status: 'pending' | 'committed' | 'discarded';
  onConfirm(updated: Props['entry']): void;
  onDiscard(): void;
};

export function ConfirmEntryBubble({ entry, status, onConfirm, onDiscard }: Props) {
  const disabled = status !== 'pending';
  if (entry.kind === 'spend') return <SpendForm entry={entry} disabled={disabled} status={status} onConfirm={onConfirm} onDiscard={onDiscard} />;
  return <WorkoutForm entry={entry} disabled={disabled} status={status} onConfirm={onConfirm} onDiscard={onDiscard} />;
}

function SpendForm({ entry, disabled, status, onConfirm, onDiscard }: {
  entry: Extract<ParseResponse, { kind: 'spend' }>;
  disabled: boolean;
  status: Props['status'];
  onConfirm: Props['onConfirm'];
  onDiscard: Props['onDiscard'];
}) {
  const [amount, setAmount] = useState(String(entry.data.amount));
  const [merchant, setMerchant] = useState(entry.data.merchant ?? '');
  const [category, setCategory] = useState(entry.data.category ?? '');
  const valid = !disabled && Number.isFinite(Number(amount)) && Number(amount) > 0;

  return (
    <View className={'self-start mb-2 max-w-[88%] bg-surface border border-hair rounded-2xl p-3 ' + (status === 'discarded' ? 'opacity-50' : '')}>
      <Text className="text-caption1 text-ink3 uppercase tracking-wider mb-2">Spend · low confidence</Text>
      <Field label="Amount ($)"  value={amount}   onChangeText={setAmount}   disabled={disabled} keyboardType="decimal-pad" />
      <Field label="Merchant"    value={merchant} onChangeText={setMerchant} disabled={disabled} />
      <Field label="Category"    value={category} onChangeText={setCategory} disabled={disabled} />
      {!disabled && (
        <View className="flex-row gap-2 mt-2">
          <Pressable
            disabled={!valid}
            onPress={() => onConfirm({ ...entry, data: { ...entry.data, amount: Number(amount), merchant: merchant || undefined, category: category || undefined } })}
            className={valid ? 'flex-1 bg-money rounded-xl py-2.5 items-center' : 'flex-1 bg-fill rounded-xl py-2.5 items-center'}
          >
            <Text className={valid ? 'text-subhead text-white' : 'text-subhead text-ink3'}>Confirm</Text>
          </Pressable>
          <Pressable onPress={onDiscard} className="flex-1 bg-fill rounded-xl py-2.5 items-center">
            <Text className="text-subhead text-ink">Discard</Text>
          </Pressable>
        </View>
      )}
      {status === 'committed' && <Text className="text-caption1 text-move mt-2">Logged.</Text>}
    </View>
  );
}

function WorkoutForm({ entry, disabled, status, onConfirm, onDiscard }: {
  entry: Extract<ParseResponse, { kind: 'workout' }>;
  disabled: boolean;
  status: Props['status'];
  onConfirm: Props['onConfirm'];
  onDiscard: Props['onDiscard'];
}) {
  const [minutes, setMinutes] = useState(entry.data.durationMin != null ? String(entry.data.durationMin) : '');
  const [routine, setRoutine] = useState(entry.data.routine ?? '');
  const valid = !disabled && Number.isFinite(Number(minutes)) && Number(minutes) > 0;

  return (
    <View className={'self-start mb-2 max-w-[88%] bg-surface border border-hair rounded-2xl p-3 ' + (status === 'discarded' ? 'opacity-50' : '')}>
      <Text className="text-caption1 text-ink3 uppercase tracking-wider mb-2">Workout · low confidence</Text>
      <Field label="Minutes" value={minutes} onChangeText={setMinutes} disabled={disabled} keyboardType="number-pad" />
      <Field label="Kind"    value={routine} onChangeText={setRoutine} disabled={disabled} />
      {!disabled && (
        <View className="flex-row gap-2 mt-2">
          <Pressable
            disabled={!valid}
            onPress={() => onConfirm({ ...entry, data: { ...entry.data, durationMin: Number(minutes), routine: routine || undefined } })}
            className={valid ? 'flex-1 bg-move rounded-xl py-2.5 items-center' : 'flex-1 bg-fill rounded-xl py-2.5 items-center'}
          >
            <Text className={valid ? 'text-subhead text-white' : 'text-subhead text-ink3'}>Confirm</Text>
          </Pressable>
          <Pressable onPress={onDiscard} className="flex-1 bg-fill rounded-xl py-2.5 items-center">
            <Text className="text-subhead text-ink">Discard</Text>
          </Pressable>
        </View>
      )}
      {status === 'committed' && <Text className="text-caption1 text-move mt-2">Logged.</Text>}
    </View>
  );
}

function Field({ label, value, onChangeText, disabled, keyboardType }: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  disabled: boolean;
  keyboardType?: 'decimal-pad' | 'number-pad';
}) {
  return (
    <View className="mb-2">
      <Text className="text-caption2 text-ink3 mb-1">{label}</Text>
      <TextInput
        editable={!disabled}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        className="bg-fill rounded-lg px-3 py-2 text-body text-ink"
      />
    </View>
  );
}
