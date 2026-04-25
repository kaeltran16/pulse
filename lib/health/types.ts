export type HKActivityType =
  | 'traditionalStrengthTraining'
  | 'running'
  | 'rowing'
  | 'other';

export type WorkoutWritePayload = {
  activityType: HKActivityType;
  start: Date;
  end: Date;
};

export type HRSample = {
  bpm: number;
  sampledAt: Date;
};
