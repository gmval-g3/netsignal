// Recency score (25% weight): time decay since last message
// Recent conversations score higher

export function scoreRecency(lastMessageAt: string | null): number {
  if (!lastMessageAt) return 0;

  const lastDate = new Date(lastMessageAt);
  const now = new Date();
  const daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

  // Tiered decay
  if (daysSince <= 7) return 100;        // Last week
  if (daysSince <= 30) return 85;        // Last month
  if (daysSince <= 90) return 70;        // Last quarter
  if (daysSince <= 180) return 50;       // Last 6 months
  if (daysSince <= 365) return 30;       // Last year
  if (daysSince <= 730) return 15;       // Last 2 years
  return 5;                              // Older
}
