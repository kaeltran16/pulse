// Workout domain — exercises, routines, sample session data

const EXERCISES = [
  // Push
  { id: 'bench', name: 'Barbell Bench Press', group: 'Push', muscle: 'Chest', sf: 'figure.strengthtraining.traditional', equipment: 'Barbell', pr: { weight: 92.5, reps: 5 } },
  { id: 'ohp', name: 'Overhead Press', group: 'Push', muscle: 'Shoulders', sf: 'figure.strengthtraining.traditional', equipment: 'Barbell', pr: { weight: 57.5, reps: 5 } },
  { id: 'incline-db', name: 'Incline DB Press', group: 'Push', muscle: 'Chest', sf: 'dumbbell.fill', equipment: 'Dumbbell', pr: { weight: 32.5, reps: 8 } },
  { id: 'tricep-rope', name: 'Tricep Pushdown', group: 'Push', muscle: 'Triceps', sf: 'figure.strengthtraining.functional', equipment: 'Cable', pr: { weight: 35, reps: 12 } },
  { id: 'lateral-raise', name: 'Lateral Raise', group: 'Push', muscle: 'Shoulders', sf: 'dumbbell.fill', equipment: 'Dumbbell', pr: { weight: 12.5, reps: 12 } },

  // Pull
  { id: 'deadlift', name: 'Deadlift', group: 'Pull', muscle: 'Back', sf: 'figure.strengthtraining.traditional', equipment: 'Barbell', pr: { weight: 142.5, reps: 3 } },
  { id: 'pullup', name: 'Pull-up', group: 'Pull', muscle: 'Back', sf: 'figure.pullup', equipment: 'Bodyweight', pr: { weight: 0, reps: 11 } },
  { id: 'barbell-row', name: 'Barbell Row', group: 'Pull', muscle: 'Back', sf: 'figure.strengthtraining.traditional', equipment: 'Barbell', pr: { weight: 77.5, reps: 6 } },
  { id: 'face-pull', name: 'Face Pull', group: 'Pull', muscle: 'Rear Delts', sf: 'figure.strengthtraining.functional', equipment: 'Cable', pr: { weight: 30, reps: 15 } },
  { id: 'bicep-curl', name: 'Bicep Curl', group: 'Pull', muscle: 'Biceps', sf: 'dumbbell.fill', equipment: 'Dumbbell', pr: { weight: 17.5, reps: 10 } },

  // Legs
  { id: 'squat', name: 'Back Squat', group: 'Legs', muscle: 'Quads', sf: 'figure.strengthtraining.traditional', equipment: 'Barbell', pr: { weight: 115, reps: 5 } },
  { id: 'rdl', name: 'Romanian Deadlift', group: 'Legs', muscle: 'Hamstrings', sf: 'figure.strengthtraining.traditional', equipment: 'Barbell', pr: { weight: 95, reps: 8 } },
  { id: 'leg-press', name: 'Leg Press', group: 'Legs', muscle: 'Quads', sf: 'figure.strengthtraining.functional', equipment: 'Machine', pr: { weight: 180, reps: 10 } },
  { id: 'calf-raise', name: 'Standing Calf Raise', group: 'Legs', muscle: 'Calves', sf: 'figure.strengthtraining.functional', equipment: 'Machine', pr: { weight: 80, reps: 15 } },
  { id: 'walking-lunge', name: 'Walking Lunge', group: 'Legs', muscle: 'Quads', sf: 'figure.walk', equipment: 'Dumbbell', pr: { weight: 20, reps: 12 } },

  // Core
  { id: 'plank', name: 'Plank', group: 'Core', muscle: 'Core', sf: 'figure.core.training', equipment: 'Bodyweight', pr: { weight: 0, reps: 90 } },
  { id: 'hanging-leg', name: 'Hanging Leg Raise', group: 'Core', muscle: 'Abs', sf: 'figure.core.training', equipment: 'Bodyweight', pr: { weight: 0, reps: 12 } },

  // Cardio
  { id: 'treadmill', name: 'Treadmill Run', group: 'Cardio', muscle: 'Cardio', sf: 'figure.run', equipment: 'Treadmill' },
  { id: 'rower', name: 'Row Erg', group: 'Cardio', muscle: 'Cardio', sf: 'figure.rower', equipment: 'Rower' },
  { id: 'bike', name: 'Assault Bike', group: 'Cardio', muscle: 'Cardio', sf: 'figure.indoor.cycle', equipment: 'Bike' },
  { id: 'stairmaster', name: 'StairMaster', group: 'Cardio', muscle: 'Cardio', sf: 'figure.stair.stepper', equipment: 'Machine' },
];

// Built-in + user routines
const ROUTINES = [
  {
    id: 'push-a', name: 'Push Day A', tag: 'Upper', lastDone: '3d ago',
    estMin: 55, exerciseCount: 5, color: 'move',
    exercises: [
      { id: 'bench', sets: [{ reps: 5, weight: 80 }, { reps: 5, weight: 85 }, { reps: 5, weight: 90 }, { reps: 5, weight: 90 }] },
      { id: 'ohp', sets: [{ reps: 6, weight: 50 }, { reps: 6, weight: 52.5 }, { reps: 6, weight: 55 }] },
      { id: 'incline-db', sets: [{ reps: 10, weight: 28 }, { reps: 10, weight: 30 }, { reps: 8, weight: 30 }] },
      { id: 'lateral-raise', sets: [{ reps: 12, weight: 10 }, { reps: 12, weight: 10 }, { reps: 12, weight: 12 }] },
      { id: 'tricep-rope', sets: [{ reps: 12, weight: 30 }, { reps: 12, weight: 32.5 }, { reps: 10, weight: 35 }] },
    ],
  },
  {
    id: 'pull-a', name: 'Pull Day A', tag: 'Upper', lastDone: '5d ago',
    estMin: 58, exerciseCount: 5, color: 'rituals',
    exercises: [
      { id: 'deadlift', sets: [{ reps: 3, weight: 120 }, { reps: 3, weight: 130 }, { reps: 3, weight: 140 }] },
      { id: 'pullup', sets: [{ reps: 8 }, { reps: 8 }, { reps: 6 }] },
      { id: 'barbell-row', sets: [{ reps: 8, weight: 70 }, { reps: 8, weight: 75 }, { reps: 6, weight: 77.5 }] },
      { id: 'face-pull', sets: [{ reps: 15, weight: 25 }, { reps: 15, weight: 27.5 }, { reps: 15, weight: 30 }] },
      { id: 'bicep-curl', sets: [{ reps: 10, weight: 15 }, { reps: 10, weight: 17.5 }, { reps: 8, weight: 17.5 }] },
    ],
  },
  {
    id: 'legs', name: 'Leg Day', tag: 'Lower', lastDone: '2d ago',
    estMin: 62, exerciseCount: 5, color: 'money',
    exercises: [
      { id: 'squat', sets: [{ reps: 5, weight: 100 }, { reps: 5, weight: 105 }, { reps: 5, weight: 110 }, { reps: 5, weight: 110 }] },
      { id: 'rdl', sets: [{ reps: 8, weight: 80 }, { reps: 8, weight: 85 }, { reps: 8, weight: 90 }] },
      { id: 'leg-press', sets: [{ reps: 10, weight: 160 }, { reps: 10, weight: 170 }, { reps: 10, weight: 180 }] },
      { id: 'walking-lunge', sets: [{ reps: 12, weight: 18 }, { reps: 12, weight: 20 }, { reps: 10, weight: 20 }] },
      { id: 'calf-raise', sets: [{ reps: 15, weight: 70 }, { reps: 15, weight: 75 }, { reps: 12, weight: 80 }] },
    ],
  },
  {
    id: 'upper-power', name: 'Upper Power', tag: 'Custom', lastDone: '1w ago',
    estMin: 45, exerciseCount: 4, color: 'accent',
    exercises: [
      { id: 'bench', sets: [{ reps: 3, weight: 90 }, { reps: 3, weight: 90 }, { reps: 3, weight: 92.5 }] },
      { id: 'barbell-row', sets: [{ reps: 5, weight: 75 }, { reps: 5, weight: 77.5 }, { reps: 5, weight: 77.5 }] },
      { id: 'ohp', sets: [{ reps: 5, weight: 52.5 }, { reps: 5, weight: 55 }, { reps: 5, weight: 55 }] },
      { id: 'pullup', sets: [{ reps: 6 }, { reps: 6 }, { reps: 5 }] },
    ],
  },
  {
    id: 'treadmill-int', name: 'Treadmill Intervals', tag: 'Cardio', lastDone: 'Yesterday',
    estMin: 30, exerciseCount: 1, color: 'move',
    exercises: [
      { id: 'treadmill', sets: [{ duration: 30, distance: 5.0, pace: '6:00' }] },
    ],
  },
  {
    id: 'row-steady', name: 'Steady Row 5k', tag: 'Cardio', lastDone: '4d ago',
    estMin: 25, exerciseCount: 1, color: 'move',
    exercises: [
      { id: 'rower', sets: [{ duration: 25, distance: 5.0, pace: '2:00' }] },
    ],
  },
];

// Past workout sessions (for history + detail screen)
const PAST_SESSIONS = [
  {
    id: 's1', date: 'Today, 17:45', routineId: 'push-a', routineName: 'Push Day A',
    duration: 52, volume: 4250, prs: 1, group: 'Push',
    exercises: [
      { name: 'Barbell Bench Press', sets: [
        { reps: 5, weight: 80, done: true },
        { reps: 5, weight: 85, done: true },
        { reps: 5, weight: 90, done: true, pr: true },
        { reps: 5, weight: 90, done: true },
      ]},
      { name: 'Overhead Press', sets: [
        { reps: 6, weight: 50, done: true },
        { reps: 6, weight: 52.5, done: true },
        { reps: 6, weight: 55, done: true },
      ]},
      { name: 'Incline DB Press', sets: [
        { reps: 10, weight: 28, done: true },
        { reps: 10, weight: 30, done: true },
        { reps: 8, weight: 30, done: true },
      ]},
      { name: 'Lateral Raise', sets: [
        { reps: 12, weight: 10, done: true },
        { reps: 12, weight: 10, done: true },
        { reps: 12, weight: 12, done: true },
      ]},
      { name: 'Tricep Pushdown', sets: [
        { reps: 12, weight: 30, done: true },
        { reps: 12, weight: 32.5, done: true },
        { reps: 10, weight: 35, done: true },
      ]},
    ],
  },
];

Object.assign(window, { EXERCISES, ROUTINES, PAST_SESSIONS });
