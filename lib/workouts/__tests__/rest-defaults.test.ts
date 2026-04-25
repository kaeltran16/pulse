/** @jest-environment node */
import { REST_DEFAULTS, getRestSeconds } from '../rest-defaults';

describe('REST_DEFAULTS', () => {
  it('exposes the group constants', () => {
    expect(REST_DEFAULTS).toEqual({ Push: 120, Pull: 120, Legs: 150, Core: 60, Cardio: 0 });
  });
});

describe('getRestSeconds', () => {
  it('returns the group default when override is null', () => {
    expect(getRestSeconds('Push', null)).toBe(120);
    expect(getRestSeconds('Legs', null)).toBe(150);
    expect(getRestSeconds('Cardio', null)).toBe(0);
  });

  it('honors a positive override over the default', () => {
    expect(getRestSeconds('Push', 90)).toBe(90);
    expect(getRestSeconds('Cardio', 30)).toBe(30);
  });

  it('honors an explicit zero override', () => {
    expect(getRestSeconds('Push', 0)).toBe(0);
  });
});
