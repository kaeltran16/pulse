import { useState } from 'react';
import { ActionSheetIOS, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { db } from '@/lib/db/client';
import {
  hardDeleteRitual,
  insertRitual,
  updateRitual,
} from '@/lib/db/queries/rituals';
import { cadenceDisplay } from '@/lib/sync/cadenceDisplay';
import {
  RITUAL_ICON_SHORTLIST,
  type RitualCadence,
  type RitualColor,
  type RitualIcon,
} from '@/lib/api-types';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

const COLOR_TOKENS: RitualColor[] = ['rituals', 'accent', 'move', 'money', 'cyan'];
const CADENCES: RitualCadence[] = ['morning', 'evening', 'all_day', 'weekdays', 'daily'];

type RitualFormProps =
  | { mode: 'new' }
  | {
      mode: 'edit';
      id: number;
      initial: { title: string; icon: RitualIcon; cadence: RitualCadence; color: RitualColor };
    };

export default function RitualForm(props: RitualFormProps) {
  const router = useRouter();
  const { resolved } = useTheme();
  const palette = colors[resolved];

  const initial = props.mode === 'edit'
    ? props.initial
    : { title: '', icon: 'sparkles' as RitualIcon, cadence: 'daily' as RitualCadence, color: 'rituals' as RitualColor };

  const [title, setTitle] = useState(initial.title);
  const [cadence, setCadence] = useState<RitualCadence>(initial.cadence);
  const [icon, setIcon] = useState<RitualIcon>(initial.icon);
  const [color, setColor] = useState<RitualColor>(initial.color);

  const canSave = title.trim().length >= 1 && title.trim().length <= 40;

  const colorHex = (token: RitualColor): string => {
    switch (token) {
      case 'rituals': return palette.rituals;
      case 'accent':  return palette.accent;
      case 'move':    return palette.move;
      case 'money':   return palette.money;
      case 'cyan':    return palette.cyan;
    }
  };

  const onPickCadence = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [...CADENCES.map((c) => cadenceDisplay(c, 'today')), 'Cancel'],
        cancelButtonIndex: CADENCES.length,
      },
      (i) => {
        if (i < CADENCES.length) setCadence(CADENCES[i]);
      },
    );
  };

  const onSave = async () => {
    if (!canSave) return;
    if (props.mode === 'new') {
      await insertRitual(db, { title: title.trim(), icon, cadence, color, active: true });
    } else {
      await updateRitual(db, props.id, { title: title.trim(), icon, cadence, color });
    }
    router.back();
  };

  const onDelete = () => {
    if (props.mode !== 'edit') return;
    Alert.alert(
      `Delete '${title || initial.title}'?`,
      'This permanently removes the ritual and all its history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await hardDeleteRitual(db, props.id);
            router.back();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
        <View className="flex-row items-center justify-between px-3 py-3">
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text className="text-callout" style={{ color: palette.accent }}>Cancel</Text>
          </Pressable>
          <Text className="text-headline text-ink">{props.mode === 'new' ? 'New ritual' : 'Edit ritual'}</Text>
          <Pressable onPress={onSave} disabled={!canSave} hitSlop={8}>
            <Text className="text-callout" style={{ color: canSave ? palette.accent : palette.ink4, fontWeight: '600' }}>
              Save
            </Text>
          </Pressable>
        </View>

        <View className="px-3 pb-2">
          <Text className="text-caption1 text-ink3 uppercase mb-1 px-1">Basics</Text>
          <View className="rounded-xl bg-surface overflow-hidden">
            <View className="flex-row items-center px-4 py-3" style={{ borderBottomWidth: 0.5, borderBottomColor: palette.hair }}>
              <Text className="text-callout text-ink2 w-24">Name</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Morning pages"
                placeholderTextColor={palette.ink4}
                autoCapitalize="sentences"
                maxLength={40}
                className="flex-1 text-callout text-ink text-right"
              />
            </View>
            <Pressable onPress={onPickCadence} className="flex-row items-center px-4 py-3">
              <Text className="text-callout text-ink2 w-24">Cadence</Text>
              <Text className="flex-1 text-callout text-ink3 text-right mr-1">
                {cadenceDisplay(cadence, 'today')}
              </Text>
              <Text className="text-ink4">›</Text>
            </Pressable>
          </View>
        </View>

        <View className="px-3 pb-2">
          <Text className="text-caption1 text-ink3 uppercase mb-1 px-1">Style</Text>
          <View className="rounded-xl bg-surface p-4">
            <Text className="text-caption2 text-ink3 mb-2">Icon</Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {RITUAL_ICON_SHORTLIST.map((sym) => {
                const selected = icon === sym;
                return (
                  <Pressable
                    key={sym}
                    onPress={() => setIcon(sym)}
                    className="h-14 w-14 rounded-xl items-center justify-center"
                    style={{
                      backgroundColor: palette.fill,
                      opacity: selected ? 1 : 0.5,
                      borderWidth: selected ? 2 : 0,
                      borderColor: palette.accent,
                    }}
                  >
                    <SymbolView name={sym as never} size={22} tintColor={palette.ink} />
                  </Pressable>
                );
              })}
            </View>

            <Text className="text-caption2 text-ink3 mt-4 mb-2">Color</Text>
            <View className="flex-row" style={{ gap: 12 }}>
              {COLOR_TOKENS.map((c) => {
                const selected = color === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setColor(c)}
                    className="h-8 w-8 rounded-full items-center justify-center"
                    style={{
                      backgroundColor: colorHex(c),
                      borderWidth: selected ? 3 : 0,
                      borderColor: palette.ink,
                    }}
                  />
                );
              })}
            </View>
          </View>
        </View>

        {props.mode === 'edit' && (
          <View className="px-3 pb-2">
            <Text className="text-caption1 text-ink3 uppercase mb-1 px-1">Danger</Text>
            <Pressable
              onPress={onDelete}
              className="rounded-xl bg-surface flex-row items-center px-4 py-3"
            >
              <View className="h-8 w-8 rounded-lg items-center justify-center mr-3" style={{ backgroundColor: '#FF3B30' }}>
                <SymbolView name="trash.fill" size={14} tintColor="#fff" />
              </View>
              <Text className="text-callout" style={{ color: '#FF3B30', fontWeight: '500' }}>Delete ritual</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
