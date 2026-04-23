// Design tokens — modern iOS system look

const THEMES = {
  light: {
    name: 'Light',
    bg: '#F2F2F7',           // iOS systemGroupedBackground
    surface: '#FFFFFF',      // card
    surface2: '#F2F2F7',
    ink: '#000000',
    ink2: 'rgba(60,60,67,0.85)',
    ink3: 'rgba(60,60,67,0.6)',
    ink4: 'rgba(60,60,67,0.3)',
    hair: 'rgba(60,60,67,0.12)',
    blur: 'rgba(242,242,247,0.72)',
    // iOS system accent set
    money: '#FF9500',        // systemOrange
    moneyTint: 'rgba(255,149,0,0.14)',
    move: '#34C759',         // systemGreen
    moveTint: 'rgba(52,199,89,0.14)',
    rituals: '#AF52DE',      // systemPurple
    ritualsTint: 'rgba(175,82,222,0.14)',
    accent: '#007AFF',       // systemBlue
    accentTint: 'rgba(0,122,255,0.14)',
    red: '#FF3B30',
    fill: 'rgba(120,120,128,0.12)',
  },
  dark: {
    name: 'Dark',
    bg: '#000000',
    surface: '#1C1C1E',
    surface2: '#2C2C2E',
    ink: '#FFFFFF',
    ink2: 'rgba(235,235,245,0.85)',
    ink3: 'rgba(235,235,245,0.6)',
    ink4: 'rgba(235,235,245,0.3)',
    hair: 'rgba(84,84,88,0.65)',
    blur: 'rgba(0,0,0,0.72)',
    money: '#FF9F0A',
    moneyTint: 'rgba(255,159,10,0.18)',
    move: '#30D158',
    moveTint: 'rgba(48,209,88,0.18)',
    rituals: '#BF5AF2',
    ritualsTint: 'rgba(191,90,242,0.18)',
    accent: '#0A84FF',
    accentTint: 'rgba(10,132,255,0.18)',
    red: '#FF453A',
    fill: 'rgba(120,120,128,0.24)',
  },
};

const TODAY_ENTRIES = [
  { id: 1, time: '06:42', type: 'rituals', title: 'Morning pages', detail: '15 min · journal', value: null, sf: 'book.closed.fill' },
  { id: 2, time: '07:15', type: 'move', title: 'Run · Mission loop', detail: '4.8 km · 24:10', value: '287 kcal', sf: 'figure.run' },
  { id: 3, time: '08:30', type: 'money', title: 'Verve Coffee', detail: 'Coffee · cortado', value: -5.75, sf: 'cup.and.saucer.fill' },
  { id: 4, time: '09:10', type: 'rituals', title: 'Inbox zero', detail: '22 min · focus', value: null, sf: 'tray.fill' },
  { id: 5, time: '12:40', type: 'money', title: 'Tartine', detail: 'Lunch · sandwich', value: -16.20, sf: 'fork.knife' },
  { id: 6, time: '14:20', type: 'rituals', title: 'Spanish practice', detail: '18 min · Duolingo', value: null, sf: 'character.book.closed.fill' },
  { id: 7, time: '17:45', type: 'move', title: 'Strength · push', detail: '42 min · gym', value: '312 kcal', sf: 'dumbbell.fill' },
  { id: 8, time: '19:10', type: 'money', title: 'Whole Foods', detail: 'Groceries · dinner', value: -38.40, sf: 'basket.fill' },
  { id: 9, time: '21:30', type: 'rituals', title: 'Read · Pachinko', detail: '28 min · 19 pgs', value: null, sf: 'books.vertical.fill' },
];

const WEEK_DATA = [
  { day: 'M', date: 17, money: 42, move: 28, rituals: 3 },
  { day: 'T', date: 18, money: 78, move: 0, rituals: 4 },
  { day: 'W', date: 19, money: 28, move: 55, rituals: 5 },
  { day: 'T', date: 20, money: 62, move: 42, rituals: 4 },
  { day: 'F', date: 21, money: 120, move: 30, rituals: 3 },
  { day: 'S', date: 22, money: 45, move: 75, rituals: 2 },
  { day: 'S', date: 23, money: 60, move: 66, rituals: 4 },
];

const TYPE_META = {
  money:   { label: 'Spending', singular: 'Expense' },
  move:    { label: 'Activity', singular: 'Workout' },
  rituals: { label: 'Routine',  singular: 'Ritual' },
};

Object.assign(window, { THEMES, TODAY_ENTRIES, WEEK_DATA, TYPE_META });
