import { useMemo, useReducer, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';
import { db } from '@/lib/db/client';
import { generateRoutine } from '@/lib/pal/client';
import {
  AuthError,
  GenerationFailedError,
  NetworkError,
  RateLimitError,
  UpstreamError,
  ValidationError,
} from '@/lib/pal/errors';
import { saveGeneratedRoutine } from '@/lib/db/queries/saveGeneratedRoutine';
import { SEEDED_EXERCISES } from '@/lib/db/seed-workouts';
import { initialState, reducer } from './generate.reducer';
import { GenerateHero } from '@/components/move/generate/GenerateHero';
import { PromptCard } from '@/components/move/generate/PromptCard';
import { QuickPickGrid } from '@/components/move/generate/QuickPickGrid';
import { LoadingPill } from '@/components/move/generate/LoadingPill';
import { ErrorBanner } from '@/components/move/generate/ErrorBanner';
import { ResultHero } from '@/components/move/generate/ResultHero';
import { ResultExerciseList } from '@/components/move/generate/ResultExerciseList';
import { ResultActions } from '@/components/move/generate/ResultActions';

function uiMessage(e: unknown): string {
  if (e instanceof GenerationFailedError) return "Pal couldn't put that together. Try a different goal?";
  if (e instanceof UpstreamError)         return "Pal's having trouble right now. Try again in a moment.";
  if (e instanceof NetworkError)          return 'No connection. Check your internet and try again.';
  if (e instanceof RateLimitError)        return 'Too many tries — wait a moment and retry.';
  if (e instanceof AuthError)             return "Something's off — try again.";
  if (e instanceof ValidationError)       return "Something's off — try again.";
  return "Something's off — try again.";
}

export default function GenerateRoutineScreen() {
  const router = useRouter();
  const { resolved } = useTheme();
  const palette = colors[resolved];

  const [state, dispatch] = useReducer(reducer, initialState);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const seedById = useMemo(() => new Map(SEEDED_EXERCISES.map((e) => [e.id, e])), []);

  async function runGenerate(goalText: string) {
    dispatch({ type: 'submit' });
    try {
      const data = await generateRoutine(goalText);
      dispatch({ type: 'succeeded', data });
    } catch (e) {
      dispatch({ type: 'failed', message: uiMessage(e) });
    }
  }

  async function onSave() {
    if (state.phase !== 'result') return;
    setSaving(true);
    setSaveError(null);
    try {
      const id = await saveGeneratedRoutine(db, state.data);
      router.replace({
        pathname: '/(tabs)/move/[routineId]/edit',
        params: { routineId: String(id) },
      });
    } catch {
      setSaveError("Couldn't save. Try again.");
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{ paddingBottom: 110 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
        <Pressable onPress={() => router.back()} style={{ padding: 8 }}>
          <Text style={{ color: palette.accent, fontSize: 17 }}>Cancel</Text>
        </Pressable>
        <Text
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: 17,
            fontWeight: '600',
            color: palette.ink,
          }}
        >
          Generate with AI
        </Text>
        <View style={{ width: 64 }} />
      </View>

      {state.phase !== 'result' && (
        <>
          <View style={{ paddingHorizontal: 16, paddingBottom: 18 }}>
            <GenerateHero />
          </View>
          <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
            <PromptCard
              value={state.prompt}
              onChange={(v) => dispatch({ type: 'edit_prompt', value: v })}
              onSubmit={() => runGenerate(state.prompt)}
              loading={state.phase === 'loading'}
            />
          </View>
          {state.phase === 'idle' && (
            <View style={{ paddingHorizontal: 16 }}>
              <QuickPickGrid
                onPick={(label) => {
                  dispatch({ type: 'edit_prompt', value: label });
                  void runGenerate(label);
                }}
                loading={false}
              />
            </View>
          )}
          {state.phase === 'loading' && <LoadingPill />}
          {state.phase === 'error' && (
            <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
              <ErrorBanner message={state.message} />
            </View>
          )}
        </>
      )}

      {state.phase === 'result' && (
        <>
          <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
            <ResultHero
              routine={{
                name: state.data.name,
                tag: state.data.tag,
                estMin: state.data.estMin,
                rationale: state.data.rationale,
                exerciseCount: state.data.exercises.length,
              }}
            />
          </View>
          <View style={{ paddingHorizontal: 16 }}>
            <ResultExerciseList
              exercises={state.data.exercises.flatMap((ex) => {
                const meta = seedById.get(ex.id);
                if (!meta) return [];
                return [
                  {
                    id: ex.id,
                    name: meta.name,
                    muscle: meta.muscle,
                    equipment: meta.equipment,
                    sf: meta.sfSymbol,
                    sets: ex.sets.map((s) => ({
                      weight: 'weight' in s ? s.weight : undefined,
                      reps: 'reps' in s ? s.reps : undefined,
                      duration: 'duration' in s ? s.duration : undefined,
                      distance: 'distance' in s ? s.distance : undefined,
                      pace: 'pace' in s ? s.pace : undefined,
                    })),
                  },
                ];
              })}
            />
          </View>
          {saveError && (
            <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
              <ErrorBanner message={saveError} />
            </View>
          )}
          <ResultActions
            onTryAgain={() => dispatch({ type: 'reset' })}
            onSave={onSave}
            saving={saving}
          />
        </>
      )}
    </ScrollView>
  );
}
