import '../global.css';

import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { db } from '@/lib/db/client';
import { useDbMigrations } from '@/lib/db/migrate';
import { isOnboardingComplete } from '@/lib/db/queries/onboarding';
import { getOpenDraft } from '@/lib/db/queries/sessions';
import { useActiveSessionStore } from '@/lib/state/activeSessionStore';
import { ThemeProvider } from '@/lib/theme/provider';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <Boot>
        <Slot />
      </Boot>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

function Boot({ children }: { children: React.ReactNode }) {
  const { success, error } = useDbMigrations();
  const router = useRouter();
  const segments = useSegments();
  const resumeChecked = React.useRef(false);

  useEffect(() => {
    if (!success) return;
    let cancelled = false;
    (async () => {
      const done = await isOnboardingComplete(db);
      if (cancelled) return;
      const inOnboarding = segments[0] === 'onboarding';
      if (!done && !inOnboarding) {
        router.replace('/onboarding');
        return;
      }
      if (done && inOnboarding) {
        router.replace('/(tabs)/today');
        return;
      }

      if (!resumeChecked.current && done) {
        resumeChecked.current = true;
        try {
          const draft = await getOpenDraft(db);
          if (cancelled) return;
          if (draft) {
            await useActiveSessionStore.getState().hydrateFromDraft(draft);
            router.push('/(tabs)/move/active');
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('Resume check failed:', e);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [success, segments, router]);

  if (error) {
    throw error;
  }
  if (!success) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator />
      </View>
    );
  }
  return <>{children}</>;
}
