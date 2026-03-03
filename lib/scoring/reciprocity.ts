// Reciprocity score (30% weight): measures bidirectional engagement
// High scores = both sides actively messaging with balanced turn-taking

export function scoreReciprocity(userMessages: number, contactMessages: number): number {
  const total = userMessages + contactMessages;
  if (total === 0) return 0;

  // Must be bidirectional
  if (userMessages === 0 || contactMessages === 0) return 0;

  // Balance ratio (1.0 = perfectly balanced)
  const ratio = Math.min(userMessages, contactMessages) / Math.max(userMessages, contactMessages);

  // Turn-taking bonus: more exchanges = more engagement
  const exchanges = Math.min(userMessages, contactMessages);
  const exchangeBonus = Math.min(exchanges / 10, 1); // caps at 10 exchanges

  // Base score from ratio (0-70) + exchange bonus (0-30)
  const score = (ratio * 70) + (exchangeBonus * 30);

  return Math.round(Math.min(score, 100));
}
