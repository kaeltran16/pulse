export type PRSnapshot = Map<string, { weightKg: number; reps: number }>;

export interface SessionSetInput {
  exerciseId: string;
  reps: number | null;
  weightKg: number | null;
}

export interface PRDetectionResult {
  isPrPerSet: boolean[];
  newPRs: Map<string, { weightKg: number; reps: number; setIndex: number }>;
}

export function detectSessionPRs(
  snapshot: PRSnapshot,
  sessionSets: SessionSetInput[],
): PRDetectionResult {
  const isPrPerSet: boolean[] = new Array(sessionSets.length).fill(false);
  const newPRs = new Map<string, { weightKg: number; reps: number; setIndex: number }>();

  for (let i = 0; i < sessionSets.length; i++) {
    const s = sessionSets[i];
    if (s.reps === null || s.weightKg === null) continue;

    const product = s.reps * s.weightKg;
    const prior = snapshot.get(s.exerciseId);
    const beatsPrior = prior === undefined || product > prior.weightKg * prior.reps;
    if (!beatsPrior) continue;

    isPrPerSet[i] = true;

    const existing = newPRs.get(s.exerciseId);
    if (existing === undefined || product > existing.weightKg * existing.reps) {
      newPRs.set(s.exerciseId, { weightKg: s.weightKg, reps: s.reps, setIndex: i });
    }
  }

  return { isPrPerSet, newPRs };
}
