import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

const STEPS = [
  { icon: 'bell.fill', tone: 'money', title: 'Your bank sends alerts', sub: '"You spent $12.40 at Blue Bottle" — most cards do this' },
  { icon: 'magnifyingglass', tone: 'accent', title: 'Pal reads only those', sub: 'Filtered by sender list before anything is parsed' },
  { icon: 'sparkles', tone: 'rituals', title: 'It lands on Today', sub: 'Categorized, deduped, tagged as synced' },
] as const;

export default function EmailSyncIntroScreen() {
  const router = useRouter();
  const { resolved } = useTheme();
  const palette = colors[resolved];

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="flex-row items-center px-3 py-3">
          <Pressable onPress={() => router.back()} className="flex-row items-center" hitSlop={8}>
            <Text className="text-callout" style={{ color: palette.accent }}>‹ You</Text>
          </Pressable>
        </View>

        <View className="px-6 pt-2 pb-6 items-center">
          <View
            className="h-28 w-28 rounded-3xl items-center justify-center mb-5"
            style={{ backgroundColor: palette.accentTint }}
          >
            <SymbolView name="tray.fill" size={48} tintColor={palette.accent} />
          </View>
          <Text className="text-title1 text-ink text-center" style={{ lineHeight: 32 }}>
            Stop logging card{'\n'}charges by hand.
          </Text>
          <Text className="text-subhead text-ink2 text-center mt-3">
            Connect your inbox with a read-only app password. Pal scans for bank alert emails in the background and drops them on your timeline — categorized, deduped, silent.
          </Text>
        </View>

        <View className="px-3 pb-4">
          <Text className="text-caption1 text-ink3 uppercase mb-1 px-1">How it works</Text>
          <View className="rounded-xl bg-surface overflow-hidden">
            {STEPS.map((step, i) => {
              const tone = palette[step.tone];
              const tint =
                step.tone === 'money' ? palette.moneyTint :
                step.tone === 'accent' ? palette.accentTint : palette.ritualsTint;
              return (
                <View
                  key={i}
                  className="flex-row px-4 py-3"
                  style={{ borderBottomWidth: i === STEPS.length - 1 ? 0 : 0.5, borderBottomColor: palette.hair }}
                >
                  <View className="h-8 w-8 rounded-lg items-center justify-center mr-3" style={{ backgroundColor: tint }}>
                    <SymbolView name={step.icon as never} size={16} tintColor={tone} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-callout text-ink">{step.title}</Text>
                    <Text className="text-caption1 text-ink3 mt-1">{step.sub}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View className="px-4 pb-4">
          <View className="rounded-xl p-3" style={{ backgroundColor: palette.accentTint, borderWidth: 0.5, borderColor: palette.accent + '33' }}>
            <Text className="text-caption1 text-ink2">
              <Text className="text-ink">App password, not your real one. </Text>
              You generate a disposable password in your email settings — Pal stores it encrypted at rest on our server. Revoke it anytime from Gmail without touching anything else.
            </Text>
          </View>
        </View>

        <View className="px-4 pt-2">
          <Pressable
            onPress={() => router.push('/(tabs)/you/email-sync/connect')}
            className="rounded-2xl py-4 items-center"
            style={{ backgroundColor: palette.ink }}
          >
            <Text className="text-headline" style={{ color: palette.bg }}>Set up Gmail sync</Text>
          </Pressable>
          <Text className="text-caption1 text-ink4 text-center mt-2">iCloud, Outlook, any IMAP coming</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
