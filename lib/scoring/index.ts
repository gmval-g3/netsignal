import { scoreReciprocity } from './reciprocity';
import { scoreRecency } from './recency';
import { scoreFrequency } from './frequency';
import { scoreSignals } from './signals';
import { shouldExclude } from './filters';

const WEIGHTS = {
  reciprocity: 0.30,
  recency: 0.25,
  frequency: 0.20,
  signal: 0.15,
  depth: 0.10,
};

export interface ConversationRow {
  conversation_id: string;
  contact_id: number;
  is_group: boolean;
  first_message_at: string;
  last_message_at: string;
  message_count: number;
}

export interface MessageRow {
  conversation_id: string;
  content: string;
  is_from_user: boolean;
  sent_at: string;
  has_signal_words: boolean;
  signal_words_found: string | null;
}

export interface LeadScoreRow {
  contact_id: number;
  reciprocity_score: number;
  frequency_score: number;
  depth_score: number;
  signal_score: number;
  recency_score: number;
  total_score: number;
  tier: string;
  total_messages: number;
  user_messages: number;
  contact_messages: number;
  last_message_at: string;
  last_message_preview: string;
}

function scoreDepth(messages: { content: string; is_from_user: boolean }[]): number {
  if (messages.length === 0) return 0;

  const avgLength = messages.reduce((sum, m) => sum + (m.content?.length || 0), 0) / messages.length;

  // Substantive messages (>50 chars)
  const substantiveRatio = messages.filter(m => (m.content?.length || 0) > 50).length / messages.length;

  // Score from average length (0-50) + substantive ratio (0-50)
  const lengthScore = Math.min(avgLength / 5, 50); // 250 chars = max
  const substantiveScore = substantiveRatio * 50;

  return Math.round(Math.min(lengthScore + substantiveScore, 100));
}

function getTier(score: number): string {
  if (score >= 55) return 'hot';
  if (score >= 30) return 'warm';
  return 'cold';
}

/**
 * Pure scoring function. Takes conversation and message data arrays,
 * returns an array of lead score rows to upsert.
 */
export function runScoring(
  conversations: ConversationRow[],
  messages: MessageRow[]
): { scores: LeadScoreRow[]; tiers: { hot: number; warm: number; cold: number } } {
  // Index messages by conversation_id for fast lookup
  const messagesByConv = new Map<string, MessageRow[]>();
  for (const msg of messages) {
    const existing = messagesByConv.get(msg.conversation_id) || [];
    existing.push(msg);
    messagesByConv.set(msg.conversation_id, existing);
  }

  // Group conversations by contact
  const contactConvs = new Map<number, ConversationRow[]>();
  for (const conv of conversations) {
    const existing = contactConvs.get(conv.contact_id) || [];
    existing.push(conv);
    contactConvs.set(conv.contact_id, existing);
  }

  const tiers = { hot: 0, warm: 0, cold: 0 };
  const scores: LeadScoreRow[] = [];

  for (const [contactId, convs] of contactConvs) {
    // Aggregate messages across all conversations for this contact
    let allMessages: MessageRow[] = [];
    let totalUser = 0;
    let totalContact = 0;
    let hasGroup = false;
    let latestMessageAt = '';

    for (const conv of convs) {
      if (conv.is_group) { hasGroup = true; continue; }

      const msgs = messagesByConv.get(conv.conversation_id) || [];
      // Sort by sent_at
      msgs.sort((a, b) => (a.sent_at || '').localeCompare(b.sent_at || ''));
      allMessages = allMessages.concat(msgs);

      for (const m of msgs) {
        if (m.is_from_user) totalUser++;
        else totalContact++;
      }

      if (!latestMessageAt || conv.last_message_at > latestMessageAt) {
        latestMessageAt = conv.last_message_at;
      }
    }

    // Apply pre-filters
    const filterResult = shouldExclude({
      conversationId: convs[0].conversation_id,
      contactId,
      isGroup: hasGroup && convs.length === 1,
      userMessages: totalUser,
      contactMessages: totalContact,
      lastContent: '',
    });

    if (filterResult.excluded) continue;

    // Score each dimension
    const reciprocity = scoreReciprocity(totalUser, totalContact);
    const recency = scoreRecency(latestMessageAt);
    const frequency = scoreFrequency(
      allMessages.length,
      allMessages[0]?.sent_at || null,
      allMessages[allMessages.length - 1]?.sent_at || null,
      allMessages.map(m => m.sent_at)
    );

    const signalWordsPerMessage = allMessages
      .filter(m => m.has_signal_words && m.signal_words_found)
      .map(m => m.signal_words_found!.split(','));
    const signal = scoreSignals(signalWordsPerMessage);

    const depth = scoreDepth(allMessages);

    // Weighted total
    const total = Math.round(
      reciprocity * WEIGHTS.reciprocity +
      recency * WEIGHTS.recency +
      frequency * WEIGHTS.frequency +
      signal * WEIGHTS.signal +
      depth * WEIGHTS.depth
    );

    const tier = getTier(total);
    tiers[tier as keyof typeof tiers]++;

    // Last message preview
    const lastMsg = allMessages[allMessages.length - 1];
    const preview = lastMsg?.content?.substring(0, 100) || '';

    scores.push({
      contact_id: contactId,
      reciprocity_score: reciprocity,
      frequency_score: frequency,
      depth_score: depth,
      signal_score: signal,
      recency_score: recency,
      total_score: total,
      tier,
      total_messages: allMessages.length,
      user_messages: totalUser,
      contact_messages: totalContact,
      last_message_at: latestMessageAt,
      last_message_preview: preview,
    });
  }

  return { scores, tiers };
}
