// Signal word score (15% weight): intent indicators
// High scores = mentions of calls, meetings, partnerships, etc.

const HIGH_VALUE_SIGNALS = ['partnership', 'collaborate', 'proposal', 'contract', 'invoice', 'referral'];
const MEDIUM_VALUE_SIGNALS = ['call', 'meeting', 'zoom', 'teams', 'demo', 'schedule'];
const LOW_VALUE_SIGNALS = ['email', 'phone', 'discuss', 'catch up', 'follow up', 'coffee', 'intro'];

export function scoreSignals(signalWordsPerMessage: string[][]): number {
  if (signalWordsPerMessage.length === 0) return 0;

  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  for (const signals of signalWordsPerMessage) {
    for (const word of signals) {
      const w = word.toLowerCase();
      if (HIGH_VALUE_SIGNALS.includes(w)) highCount++;
      else if (MEDIUM_VALUE_SIGNALS.includes(w)) mediumCount++;
      else if (LOW_VALUE_SIGNALS.includes(w)) lowCount++;
    }
  }

  // Weighted scoring
  const score = (highCount * 25) + (mediumCount * 15) + (lowCount * 8);

  // Cap at 100, with diminishing returns
  return Math.round(Math.min(score, 100));
}
