import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Stack } from 'expo-router';

import { useActiveSessionStore } from '@/lib/state/activeSessionStore';
import { SessionHeader } from '@/components/active-session/SessionHeader';
import { RestBanner } from '@/components/active-session/RestBanner';
import { ExerciseCard } from '@/components/active-session/ExerciseCard';
import { UpNextRow } from '@/components/active-session/UpNextRow';
import { CardioBody } from '@/components/active-session/CardioBody';
import { DiscardConfirmModal } from '@/components/active-session/DiscardConfirmModal';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export default function ActiveSession() {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const phase = useActiveSessionStore((s) => s.phase);
  const mode = useActiveSessionStore((s) => s.mode);
  const exercises = useActiveSessionStore((s) => s.exercises);
  const currentExerciseIdx = useActiveSessionStore((s) => s.currentExerciseIdx);
  const setDrafts = useActiveSessionStore((s) => s.setDrafts);
  const discardSession = useActiveSessionStore((s) => s.discardSession);

  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const currentExercise = exercises[currentExerciseIdx];
  const nextExercise = exercises[currentExerciseIdx + 1];

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Stack.Screen options={{ headerShown: false }} />

      <SessionHeader onBack={() => setConfirmingDiscard(true)} />

      {mode === 'strength' && <RestBanner />}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
        {phase !== 'idle' && currentExercise && mode === 'strength' && (
          <>
            <ExerciseCard exerciseIdx={currentExerciseIdx} exercise={currentExercise} />
            {nextExercise && <UpNextRow exercise={nextExercise} />}
          </>
        )}
        {phase !== 'idle' && mode === 'cardio' && <CardioBody />}
      </ScrollView>

      <DiscardConfirmModal
        visible={confirmingDiscard}
        loggedSetCount={setDrafts.length}
        onCancel={() => setConfirmingDiscard(false)}
        onConfirm={async () => {
          setConfirmingDiscard(false);
          await discardSession();
        }}
      />
    </View>
  );
}
