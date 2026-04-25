export interface DefaultRitual {
  title: string;
  icon: string;
}

export const DEFAULT_RITUALS: readonly DefaultRitual[] = [
  { title: 'Morning pages',      icon: 'book.closed.fill' },
  { title: 'Inbox zero',         icon: 'tray.fill' },
  { title: 'Language practice',  icon: 'character.book.closed.fill' },
  { title: 'Stretch',            icon: 'dumbbell.fill' },
  { title: 'Read before bed',    icon: 'books.vertical.fill' },
  { title: 'Meditate',           icon: 'heart.fill' },
] as const;
