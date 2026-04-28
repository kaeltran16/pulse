/** @jest-environment node */
import { nextMilestone } from '../nextMilestone';

describe('nextMilestone', () => {
  it.each([
    [0, 7],
    [1, 7],
    [6, 7],
    [7, 14],
    [13, 14],
    [14, 30],
    [29, 30],
    [30, 60],
    [59, 60],
    [60, 100],
    [99, 100],
    [100, 365],
    [364, 365],
    [365, null],
    [999, null],
  ] as const)('streak %i → %p', (streak, expected) => {
    expect(nextMilestone(streak)).toBe(expected);
  });
});
