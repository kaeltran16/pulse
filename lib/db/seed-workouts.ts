// Source of truth for the seeded exercise catalog and starter routines.
// Mirrors design_handoff/src/workout-data.jsx EXERCISES + ROUTINES.

export interface SeededExercise {
  id: string;
  name: string;
  group: 'Push' | 'Pull' | 'Legs' | 'Core' | 'Cardio';
  muscle: string;
  equipment: string;
  kind: 'strength' | 'cardio';
  sfSymbol: string;
}

export const SEEDED_EXERCISES: readonly SeededExercise[] = [
  // Push
  { id: 'bench',         name: 'Barbell Bench Press', group: 'Push',  muscle: 'Chest',      equipment: 'Barbell',    kind: 'strength', sfSymbol: 'figure.strengthtraining.traditional' },
  { id: 'ohp',           name: 'Overhead Press',      group: 'Push',  muscle: 'Shoulders',  equipment: 'Barbell',    kind: 'strength', sfSymbol: 'figure.strengthtraining.traditional' },
  { id: 'incline-db',    name: 'Incline DB Press',    group: 'Push',  muscle: 'Chest',      equipment: 'Dumbbell',   kind: 'strength', sfSymbol: 'dumbbell.fill' },
  { id: 'tricep-rope',   name: 'Tricep Pushdown',     group: 'Push',  muscle: 'Triceps',    equipment: 'Cable',      kind: 'strength', sfSymbol: 'figure.strengthtraining.functional' },
  { id: 'lateral-raise', name: 'Lateral Raise',       group: 'Push',  muscle: 'Shoulders',  equipment: 'Dumbbell',   kind: 'strength', sfSymbol: 'dumbbell.fill' },
  // Pull
  { id: 'deadlift',      name: 'Deadlift',            group: 'Pull',  muscle: 'Back',       equipment: 'Barbell',    kind: 'strength', sfSymbol: 'figure.strengthtraining.traditional' },
  { id: 'pullup',        name: 'Pull-up',             group: 'Pull',  muscle: 'Back',       equipment: 'Bodyweight', kind: 'strength', sfSymbol: 'figure.pullup' },
  { id: 'barbell-row',   name: 'Barbell Row',         group: 'Pull',  muscle: 'Back',       equipment: 'Barbell',    kind: 'strength', sfSymbol: 'figure.strengthtraining.traditional' },
  { id: 'face-pull',     name: 'Face Pull',           group: 'Pull',  muscle: 'Rear Delts', equipment: 'Cable',      kind: 'strength', sfSymbol: 'figure.strengthtraining.functional' },
  { id: 'bicep-curl',    name: 'Bicep Curl',          group: 'Pull',  muscle: 'Biceps',     equipment: 'Dumbbell',   kind: 'strength', sfSymbol: 'dumbbell.fill' },
  // Legs
  { id: 'squat',         name: 'Back Squat',          group: 'Legs',  muscle: 'Quads',      equipment: 'Barbell',    kind: 'strength', sfSymbol: 'figure.strengthtraining.traditional' },
  { id: 'rdl',           name: 'Romanian Deadlift',   group: 'Legs',  muscle: 'Hamstrings', equipment: 'Barbell',    kind: 'strength', sfSymbol: 'figure.strengthtraining.traditional' },
  { id: 'leg-press',     name: 'Leg Press',           group: 'Legs',  muscle: 'Quads',      equipment: 'Machine',    kind: 'strength', sfSymbol: 'figure.strengthtraining.functional' },
  { id: 'calf-raise',    name: 'Standing Calf Raise', group: 'Legs',  muscle: 'Calves',     equipment: 'Machine',    kind: 'strength', sfSymbol: 'figure.strengthtraining.functional' },
  { id: 'walking-lunge', name: 'Walking Lunge',       group: 'Legs',  muscle: 'Quads',      equipment: 'Dumbbell',   kind: 'strength', sfSymbol: 'figure.walk' },
  // Core
  { id: 'plank',         name: 'Plank',               group: 'Core',  muscle: 'Core',       equipment: 'Bodyweight', kind: 'strength', sfSymbol: 'figure.core.training' },
  { id: 'hanging-leg',   name: 'Hanging Leg Raise',   group: 'Core',  muscle: 'Abs',        equipment: 'Bodyweight', kind: 'strength', sfSymbol: 'figure.core.training' },
  // Cardio
  { id: 'treadmill',     name: 'Treadmill Run',       group: 'Cardio', muscle: 'Cardio',    equipment: 'Treadmill',  kind: 'cardio',   sfSymbol: 'figure.run' },
  { id: 'rower',         name: 'Row Erg',             group: 'Cardio', muscle: 'Cardio',    equipment: 'Rower',      kind: 'cardio',   sfSymbol: 'figure.rower' },
  { id: 'bike',          name: 'Assault Bike',        group: 'Cardio', muscle: 'Cardio',    equipment: 'Bike',       kind: 'cardio',   sfSymbol: 'figure.indoor.cycle' },
  { id: 'stairmaster',   name: 'StairMaster',         group: 'Cardio', muscle: 'Cardio',    equipment: 'Machine',    kind: 'cardio',   sfSymbol: 'figure.stair.stepper' },
];

interface SeededRoutineSetStrength { reps: number; weightKg: number }
interface SeededRoutineSetCardio   { durationSeconds: number; distanceKm: number }
type SeededRoutineSet = SeededRoutineSetStrength | SeededRoutineSetCardio;

export interface SeededRoutineExercise {
  exerciseId: string;
  restSeconds?: number;
  sets: SeededRoutineSet[];
}

export interface SeededRoutine {
  name: string;
  tag: 'Upper' | 'Lower' | 'Custom' | 'Cardio';
  color: 'move' | 'rituals' | 'money' | 'accent';
  position: number;
  exercises: SeededRoutineExercise[];
}

export const SEEDED_ROUTINES: readonly SeededRoutine[] = [
  {
    name: 'Push Day A', tag: 'Upper', color: 'move', position: 0,
    exercises: [
      { exerciseId: 'bench',         sets: [
        { reps: 5, weightKg: 80 }, { reps: 5, weightKg: 85 }, { reps: 5, weightKg: 90 }, { reps: 5, weightKg: 90 },
      ] },
      { exerciseId: 'ohp',           sets: [
        { reps: 6, weightKg: 50 }, { reps: 6, weightKg: 52.5 }, { reps: 6, weightKg: 55 },
      ] },
      { exerciseId: 'incline-db',    sets: [
        { reps: 10, weightKg: 28 }, { reps: 10, weightKg: 30 }, { reps: 8, weightKg: 30 },
      ] },
      { exerciseId: 'lateral-raise', sets: [
        { reps: 12, weightKg: 10 }, { reps: 12, weightKg: 10 }, { reps: 12, weightKg: 12 },
      ] },
      { exerciseId: 'tricep-rope',   sets: [
        { reps: 12, weightKg: 30 }, { reps: 12, weightKg: 32.5 }, { reps: 10, weightKg: 35 },
      ] },
    ],
  },
  {
    name: 'Pull Day A', tag: 'Upper', color: 'rituals', position: 1,
    exercises: [
      { exerciseId: 'deadlift',     sets: [
        { reps: 3, weightKg: 120 }, { reps: 3, weightKg: 130 }, { reps: 3, weightKg: 140 },
      ] },
      { exerciseId: 'pullup',       sets: [
        { reps: 8, weightKg: 0 }, { reps: 8, weightKg: 0 }, { reps: 6, weightKg: 0 },
      ] },
      { exerciseId: 'barbell-row',  sets: [
        { reps: 8, weightKg: 70 }, { reps: 8, weightKg: 75 }, { reps: 6, weightKg: 77.5 },
      ] },
      { exerciseId: 'face-pull',    sets: [
        { reps: 15, weightKg: 25 }, { reps: 15, weightKg: 27.5 }, { reps: 15, weightKg: 30 },
      ] },
      { exerciseId: 'bicep-curl',   sets: [
        { reps: 10, weightKg: 15 }, { reps: 10, weightKg: 17.5 }, { reps: 8, weightKg: 17.5 },
      ] },
    ],
  },
  {
    name: 'Leg Day', tag: 'Lower', color: 'money', position: 2,
    exercises: [
      { exerciseId: 'squat',         sets: [
        { reps: 5, weightKg: 100 }, { reps: 5, weightKg: 105 }, { reps: 5, weightKg: 110 }, { reps: 5, weightKg: 110 },
      ] },
      { exerciseId: 'rdl',           sets: [
        { reps: 8, weightKg: 80 }, { reps: 8, weightKg: 85 }, { reps: 8, weightKg: 90 },
      ] },
      { exerciseId: 'leg-press',     sets: [
        { reps: 10, weightKg: 160 }, { reps: 10, weightKg: 170 }, { reps: 10, weightKg: 180 },
      ] },
      { exerciseId: 'walking-lunge', sets: [
        { reps: 12, weightKg: 18 }, { reps: 12, weightKg: 20 }, { reps: 10, weightKg: 20 },
      ] },
      { exerciseId: 'calf-raise',    sets: [
        { reps: 15, weightKg: 70 }, { reps: 15, weightKg: 75 }, { reps: 12, weightKg: 80 },
      ] },
    ],
  },
  {
    name: 'Upper Power', tag: 'Custom', color: 'accent', position: 3,
    exercises: [
      { exerciseId: 'bench',       sets: [
        { reps: 3, weightKg: 90 }, { reps: 3, weightKg: 90 }, { reps: 3, weightKg: 92.5 },
      ] },
      { exerciseId: 'barbell-row', sets: [
        { reps: 5, weightKg: 75 }, { reps: 5, weightKg: 77.5 }, { reps: 5, weightKg: 77.5 },
      ] },
      { exerciseId: 'ohp',         sets: [
        { reps: 5, weightKg: 52.5 }, { reps: 5, weightKg: 55 }, { reps: 5, weightKg: 55 },
      ] },
      { exerciseId: 'pullup',      sets: [
        { reps: 6, weightKg: 0 }, { reps: 6, weightKg: 0 }, { reps: 5, weightKg: 0 },
      ] },
    ],
  },
  {
    name: 'Treadmill Intervals', tag: 'Cardio', color: 'move', position: 4,
    exercises: [
      { exerciseId: 'treadmill', sets: [
        { durationSeconds: 1800, distanceKm: 5.0 },
      ] },
    ],
  },
  {
    name: 'Steady Row 5k', tag: 'Cardio', color: 'move', position: 5,
    exercises: [
      { exerciseId: 'rower', sets: [
        { durationSeconds: 1500, distanceKm: 5.0 },
      ] },
    ],
  },
];

export function isStrengthSet(s: SeededRoutineSet): s is SeededRoutineSetStrength {
  return (s as SeededRoutineSetStrength).reps !== undefined;
}
