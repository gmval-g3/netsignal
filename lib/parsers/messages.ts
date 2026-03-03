import Papa from 'papaparse';

export interface RawMessage {
  conversationId: string;
  conversationTitle: string;
  from: string;
  senderProfileUrl: string;
  to: string;
  recipientProfileUrls: string;
  date: string;
  subject: string;
  content: string;
  folder: string;
}

const SIGNAL_WORDS = [
  'call', 'meeting', 'email', 'zoom', 'teams', 'coffee',
  'partnership', 'collaborate', 'opportunity', 'proposal',
  'schedule', 'calendar', 'demo', 'intro', 'introduction',
  'refer', 'referral', 'connect you', 'invoice', 'contract',
  'phone', 'discuss', 'catch up', 'follow up', 'followup',
];

export function detectSignalWords(content: string): string[] {
  if (!content) return [];
  const lower = content.toLowerCase();
  return SIGNAL_WORDS.filter(w => lower.includes(w));
}

export function parseMessages(csvText: string): RawMessage[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });

  return result.data
    .filter(row => row['CONVERSATION ID'])
    .map(row => ({
      conversationId: row['CONVERSATION ID']?.trim() || '',
      conversationTitle: row['CONVERSATION TITLE']?.trim() || '',
      from: row['FROM']?.trim() || '',
      senderProfileUrl: row['SENDER PROFILE URL']?.trim() || '',
      to: row['TO']?.trim() || '',
      recipientProfileUrls: row['RECIPIENT PROFILE URLS']?.trim() || '',
      date: row['DATE']?.trim() || '',
      subject: row['SUBJECT']?.trim() || '',
      content: row['CONTENT']?.trim() || '',
      folder: row['FOLDER']?.trim() || '',
    }));
}
