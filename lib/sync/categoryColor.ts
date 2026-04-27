/**
 * Maps a /parse-emitted spending category to a theme color token name (Tailwind suffix).
 * Used by the Subscriptions stacked bar (SubscriptionsScreen) to color per-merchant segments.
 * Returns 'fill' as the fallback for null / unknown categories.
 */
export function categoryToToken(category: string | null | undefined): string {
  if (!category) return 'fill';
  switch (category) {
    case 'Subscriptions':
    case 'Music':
    case 'Video':
    case 'AI':
    case 'News':
      return 'rituals';
    case 'Storage':
    case 'Work':
      return 'accent';
    case 'Fitness':
    case 'Transit':
      return 'move';
    case 'Food & Drink':
    case 'Groceries':
      return 'money';
    default:
      return 'fill';
  }
}
