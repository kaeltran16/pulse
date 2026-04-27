// Inlined ahead of Task 12 (which adds RitualCadence to lib/api-types.ts).
export type RitualCadence = 'morning' | 'evening' | 'all_day' | 'weekdays' | 'daily';

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
