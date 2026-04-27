import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export default function EmailSyncConnectScreen() {
  const router = useRouter();
  const { resolved } = useTheme();
  const palette = colors[resolved];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const canSave = email.trim().length > 3 && password.trim().length > 3;

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View className="flex-row items-center justify-between px-3 py-3">
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text className="text-callout" style={{ color: palette.accent }}>Cancel</Text>
          </Pressable>
          <Text className="text-headline text-ink">Gmail setup</Text>
          <Pressable
            onPress={() => { /* wired in Task 13 */ }}
            disabled={!canSave}
            hitSlop={8}
          >
            <Text
              className="text-callout"
              style={{ color: canSave ? palette.accent : palette.ink4, fontWeight: '600' }}
            >
              Save
            </Text>
          </Pressable>
        </View>

        <View className="px-3 pb-2">
          <Text className="text-caption1 text-ink3 uppercase mb-1 px-1">Account</Text>
          <View className="rounded-xl bg-surface overflow-hidden">
            <View className="flex-row items-center px-4 py-3" style={{ borderBottomWidth: 0.5, borderBottomColor: palette.hair }}>
              <Text className="text-callout text-ink2 w-24">Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@gmail.com"
                placeholderTextColor={palette.ink4}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                className="flex-1 text-callout text-ink text-right"
              />
            </View>
            <View className="flex-row items-center px-4 py-3">
              <Text className="text-callout text-ink2 w-24">App password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="xxxx xxxx xxxx xxxx"
                placeholderTextColor={palette.ink4}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                className="flex-1 text-callout text-ink text-right"
              />
            </View>
          </View>
          <Text className="text-caption1 text-ink3 mt-1 px-1">
            Use the Gmail address whose inbox contains your bank alert emails.
          </Text>
        </View>

        <View className="px-3 pb-2">
          <View className="rounded-xl bg-surface p-3">
            <Text className="text-caption1 text-ink uppercase mb-2">Generate a Gmail app password</Text>
            <Text className="text-caption1 text-ink2" style={{ lineHeight: 18 }}>
              1. Turn on 2-Step Verification in your Google Account.{'\n'}
              2. Open <Text style={{ color: palette.accent }}>myaccount.google.com/apppasswords</Text>.{'\n'}
              3. Create an app password labeled "Pulse" — paste the 16 characters above.
            </Text>
          </View>
        </View>

        <View className="px-3 pb-2">
          <Pressable
            onPress={() => setAdvancedOpen((v) => !v)}
            className="rounded-xl bg-surface px-4 py-3 flex-row items-center"
          >
            <View className="h-8 w-8 rounded-lg items-center justify-center mr-3" style={{ backgroundColor: palette.fill }}>
              <SymbolView name="gearshape.fill" size={14} tintColor={palette.ink2} />
            </View>
            <View className="flex-1">
              <Text className="text-callout text-ink">IMAP server</Text>
              <Text className="text-caption1 text-ink3 mt-1">imap.gmail.com · port 993 · SSL</Text>
            </View>
            <Text className="text-ink4">{advancedOpen ? '▾' : '›'}</Text>
          </Pressable>
          {advancedOpen && (
            <View className="rounded-xl bg-surface mt-2 overflow-hidden">
              {[
                { label: 'Host', value: 'imap.gmail.com' },
                { label: 'Port', value: '993' },
                { label: 'Encryption', value: 'SSL / TLS' },
              ].map((row, i, arr) => (
                <View
                  key={row.label}
                  className="flex-row items-center px-4 py-3"
                  style={{ borderBottomWidth: i === arr.length - 1 ? 0 : 0.5, borderBottomColor: palette.hair }}
                >
                  <Text className="text-callout text-ink2 w-24">{row.label}</Text>
                  <Text className="flex-1 text-callout text-ink3 text-right">{row.value}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
