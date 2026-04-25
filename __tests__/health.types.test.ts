import type { WorkoutWritePayload, HRSample, HKActivityType } from '@/lib/health/types';

describe('health types', () => {
  it('WorkoutWritePayload accepts the four supported activity types', () => {
    const types: HKActivityType[] = [
      'traditionalStrengthTraining',
      'running',
      'rowing',
      'other',
    ];
    for (const activityType of types) {
      const p: WorkoutWritePayload = {
        activityType,
        start: new Date(0),
        end: new Date(60_000),
      };
      expect(p.activityType).toBe(activityType);
    }
  });

  it('HRSample has bpm:number and sampledAt:Date', () => {
    const s: HRSample = { bpm: 72, sampledAt: new Date() };
    expect(typeof s.bpm).toBe('number');
    expect(s.sampledAt).toBeInstanceOf(Date);
  });
});
