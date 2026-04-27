/** @jest-environment node */
import { cadenceDisplay } from '../cadenceDisplay';

describe('cadenceDisplay', () => {
  describe('today context', () => {
    it.each([
      ['morning',  'Morning'],
      ['evening',  'Evening'],
      ['all_day',  'All day'],
      ['weekdays', 'Weekdays'],
      ['daily',    'Daily'],
    ] as const)('%s → %s', (cadence, expected) => {
      expect(cadenceDisplay(cadence, 'today')).toBe(expected);
    });
  });

  describe('builder context', () => {
    it.each([
      ['morning',  'Every morning'],
      ['evening',  'Evenings'],
      ['all_day',  'All day'],
      ['weekdays', 'Weekdays'],
      ['daily',    'Daily'],
    ] as const)('%s → %s', (cadence, expected) => {
      expect(cadenceDisplay(cadence, 'builder')).toBe(expected);
    });
  });
});
