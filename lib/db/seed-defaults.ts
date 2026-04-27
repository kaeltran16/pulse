// Inlined ahead of Task 12.
type RitualCadence = 'morning' | 'evening' | 'all_day' | 'weekdays' | 'daily';
type RitualColor   = 'rituals' | 'accent' | 'move' | 'money' | 'cyan';

export interface DefaultRitual {
  title: string;
  icon: string;
  cadence: RitualCadence;
  color: RitualColor;
}

export const DEFAULT_RITUALS: readonly DefaultRitual[] = [
  { title: 'Morning pages',     icon: 'book.closed.fill',           cadence: 'morning',  color: 'accent'  },
  { title: 'Inbox zero',        icon: 'tray.fill',                  cadence: 'weekdays', color: 'move'    },
  { title: 'Language practice', icon: 'character.book.closed.fill', cadence: 'daily',    color: 'move'    },
  { title: 'Stretch',           icon: 'dumbbell.fill',              cadence: 'evening',  color: 'money'   },
  { title: 'Read before bed',   icon: 'books.vertical.fill',        cadence: 'evening',  color: 'money'   },
  { title: 'Meditate',          icon: 'heart.fill',                 cadence: 'morning',  color: 'rituals' },
  { title: '8 glasses water',   icon: 'cup.and.saucer.fill',        cadence: 'all_day',  color: 'cyan'    },
] as const;
