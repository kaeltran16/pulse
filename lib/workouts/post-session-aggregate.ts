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

export interface WeeklyVolumeBucket {
  weekStart: number;
  tonnageKg: number;
}

function mondayMidnightLocal(at: number): number {
  const d = new Date(at);
  const dow = d.getDay();
  const daysSinceMonday = (dow + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysSinceMonday);
  return d.getTime();
}

function addWeeks(monday: number, weeks: number): number {
  const d = new Date(monday);
  d.setDate(d.getDate() + weeks * 7);
  return d.getTime();
}

export function computeWeeklyVolumeSeries(
  sessions: { finishedAt: number; totalVolumeKg: number }[],
  weeksBack: number,
  now: number,
): WeeklyVolumeBucket[] {
  const currentMonday = mondayMidnightLocal(now);
  const buckets: WeeklyVolumeBucket[] = [];
  for (let i = weeksBack - 1; i >= 0; i--) {
    buckets.push({ weekStart: addWeeks(currentMonday, -i), tonnageKg: 0 });
  }
  const idx = new Map<number, number>();
  buckets.forEach((b, i) => idx.set(b.weekStart, i));

  for (const s of sessions) {
    const monday = mondayMidnightLocal(s.finishedAt);
    const i = idx.get(monday);
    if (i !== undefined) {
      buckets[i].tonnageKg += s.totalVolumeKg;
    }
  }
  return buckets;
}

export interface PrHighlight {
  exerciseId: string;
  exerciseName: string;
  newWeightKg: number;
  newReps: number;
}

export interface PrInput {
  exerciseId: string;
  weightKg: number;
  reps: number;
}

export interface SelectedPRs {
  top: PrHighlight[];
  more: number;
}

export function selectTopPRs(
  prs: PrInput[],
  exerciseMetaById: Record<string, ExerciseMeta>,
  n = 2,
): SelectedPRs {
  const bestByExercise = new Map<string, PrInput>();
  for (const p of prs) {
    const existing = bestByExercise.get(p.exerciseId);
    if (!existing || p.weightKg * p.reps > existing.weightKg * existing.reps) {
      bestByExercise.set(p.exerciseId, p);
    }
  }

  const highlights: PrHighlight[] = Array.from(bestByExercise.values()).map((p) => ({
    exerciseId: p.exerciseId,
    exerciseName: exerciseMetaById[p.exerciseId]?.name ?? p.exerciseId,
    newWeightKg: p.weightKg,
    newReps: p.reps,
  }));

  highlights.sort((a, b) => b.newWeightKg - a.newWeightKg);

  return {
    top: highlights.slice(0, n),
    more: Math.max(0, highlights.length - n),
  };
}
