// Pre-filters: exclude conversations that shouldn't be scored as leads

export interface ConversationData {
  conversationId: string;
  contactId: number;
  isGroup: boolean;
  userMessages: number;
  contactMessages: number;
  lastContent: string;
}

export function shouldExclude(conv: ConversationData): { excluded: boolean; reason?: string } {
  // Group conversations
  if (conv.isGroup) {
    return { excluded: true, reason: 'group_conversation' };
  }

  // One-way inbound (spam) — contact sent, user never replied
  if (conv.contactMessages > 0 && conv.userMessages === 0) {
    return { excluded: true, reason: 'one_way_inbound' };
  }

  // One-way outbound — user sent, they never replied
  if (conv.userMessages > 0 && conv.contactMessages === 0) {
    return { excluded: true, reason: 'one_way_outbound' };
  }

  // LinkedIn system messages
  if (!conv.contactId) {
    return { excluded: true, reason: 'system_message' };
  }

  return { excluded: false };
}
