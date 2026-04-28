const LADDER = [7, 14, 30, 60, 100, 365] as const;

export function nextMilestone(streak: number): number | null {
  for (const rung of LADDER) {
    if (streak < rung) return rung;
  }
  return null;
}
