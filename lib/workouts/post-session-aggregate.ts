import type { SessionSet } from '@/lib/db/schema';

export interface ExerciseMeta {
  name: string;
  muscle: string;
  group: string;
}

export interface MuscleDistribution {
  muscle: string;
  tonnageKg: number;
  percentage: number;
}

export function computeMuscleDistribution(
  sets: SessionSet[],
  exerciseMetaById: Record<string, ExerciseMeta>,
): MuscleDistribution[] {
  const byMuscle = new Map<string, number>();
  for (const s of sets) {
    if (s.weightKg == null || s.reps == null) continue;
    const meta = exerciseMetaById[s.exerciseId];
    if (!meta) continue;
    const muscle = meta.muscle;
    if (!muscle) continue;
    byMuscle.set(muscle, (byMuscle.get(muscle) ?? 0) + s.weightKg * s.reps);
  }

  const total = Array.from(byMuscle.values()).reduce((a, b) => a + b, 0);
  if (total === 0) return [];

  return Array.from(byMuscle.entries())
    .map(([muscle, tonnageKg]) => ({
      muscle,
      tonnageKg,
      percentage: Math.round((tonnageKg / total) * 100),
    }))
    .sort((a, b) => b.tonnageKg - a.tonnageKg);
}
