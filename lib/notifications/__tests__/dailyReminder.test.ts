/** @jest-environment node */
import { reminderBody } from '../dailyReminder';

describe('reminderBody', () => {
  it('returns generic copy when zero rituals', () => {
    expect(reminderBody([])).toBe('Open Pulse — your rituals await.');
  });

  it('names the single ritual when count=1', () => {
    expect(reminderBody([{ title: 'Morning pages' }])).toBe('Morning pages waiting.');
  });

  it('lists titles when 2 or 3', () => {
    expect(reminderBody([{ title: 'A' }, { title: 'B' }])).toBe('A, B waiting.');
    expect(reminderBody([{ title: 'A' }, { title: 'B' }, { title: 'C' }])).toBe('A, B, C waiting.');
  });

  it('summarizes when 4 or more', () => {
    expect(reminderBody([
      { title: 'A' }, { title: 'B' }, { title: 'C' }, { title: 'D' },
    ])).toBe('4 rituals waiting today.');
  });
});
