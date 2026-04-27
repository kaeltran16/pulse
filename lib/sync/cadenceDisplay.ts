import type { RitualCadence } from '@/lib/api-types';

export type { RitualCadence };  // re-export for convenience
export type CadenceDisplayContext = 'today' | 'builder';

export function cadenceDisplay(cadence: RitualCadence, context: CadenceDisplayContext): string {
  if (context === 'today') {
    switch (cadence) {
      case 'morning':  return 'Morning';
      case 'evening':  return 'Evening';
      case 'all_day':  return 'All day';
      case 'weekdays': return 'Weekdays';
      case 'daily':    return 'Daily';
    }
  }
  // builder
  switch (cadence) {
    case 'morning':  return 'Every morning';
    case 'evening':  return 'Evenings';
    case 'all_day':  return 'All day';
    case 'weekdays': return 'Weekdays';
    case 'daily':    return 'Daily';
  }
}
