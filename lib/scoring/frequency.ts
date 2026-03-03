// Frequency score (20% weight): message volume + consistency
// High scores = regular messaging over multiple months

export function scoreFrequency(
  totalMessages: number,
  firstMessageAt: string | null,
  lastMessageAt: string | null,
  messageTimestamps: string[]
): number {
  if (totalMessages === 0 || !firstMessageAt || !lastMessageAt) return 0;

  // Volume score (0-50): message count with diminishing returns
  const volumeScore = Math.min(Math.log2(totalMessages + 1) * 10, 50);

  // Consistency score (0-50): how many distinct months had messages
  const months = new Set<string>();
  for (const ts of messageTimestamps) {
    const d = new Date(ts);
    months.add(`${d.getFullYear()}-${d.getMonth()}`);
  }

  const activeMonths = months.size;
  const consistencyScore = Math.min(activeMonths * 8, 50); // caps at ~6 months

  return Math.round(Math.min(volumeScore + consistencyScore, 100));
}
