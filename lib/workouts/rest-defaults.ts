export type ExerciseGroup = 'Push' | 'Pull' | 'Legs' | 'Core' | 'Cardio';

export const REST_DEFAULTS: Record<ExerciseGroup, number> = {
  Push: 120,
  Pull: 120,
  Legs: 150,
  Core: 60,
  Cardio: 0,
};

export function getRestSeconds(group: ExerciseGroup, override: number | null): number {
  if (override !== null) return override;
  return REST_DEFAULTS[group];
}
