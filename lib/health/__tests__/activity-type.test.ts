/** @jest-environment node */
import { activityTypeFor } from '../activity-type';

describe('activityTypeFor', () => {
  it('returns traditionalStrengthTraining for strength sessions regardless of equipment', () => {
    expect(
      activityTypeFor({ mode: 'strength' }, [{ equipment: 'Barbell' }]),
    ).toBe('traditionalStrengthTraining');
    expect(
      activityTypeFor({ mode: 'strength' }, []),
    ).toBe('traditionalStrengthTraining');
  });

  it('maps treadmill cardio to running', () => {
    expect(
      activityTypeFor({ mode: 'cardio' }, [{ equipment: 'Treadmill' }]),
    ).toBe('running');
  });

  it('maps outdoor-run cardio to running', () => {
    expect(
      activityTypeFor({ mode: 'cardio' }, [{ equipment: 'Outdoor Run' }]),
    ).toBe('running');
  });

  it('maps rower cardio to rowing', () => {
    expect(
      activityTypeFor({ mode: 'cardio' }, [{ equipment: 'Rower' }]),
    ).toBe('rowing');
  });

  it('maps unknown cardio equipment to other', () => {
    expect(
      activityTypeFor({ mode: 'cardio' }, [{ equipment: 'Stair climber' }]),
    ).toBe('other');
  });

  it('maps cardio with no exercises to other (defensive)', () => {
    expect(
      activityTypeFor({ mode: 'cardio' }, []),
    ).toBe('other');
  });

  it('matches case-insensitively', () => {
    expect(
      activityTypeFor({ mode: 'cardio' }, [{ equipment: 'TREADMILL' }]),
    ).toBe('running');
  });
});
