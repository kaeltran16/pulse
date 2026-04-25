export interface StrengthSet {
  reps: number | null;
  weightKg: number | null;
}

export function computeStrengthVolume(sets: StrengthSet[]): number {
  let total = 0;
  for (const s of sets) {
    if (s.reps === null || s.weightKg === null) continue;
    total += s.reps * s.weightKg;
  }
  return total;
}
