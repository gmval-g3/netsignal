import Anthropic from '@anthropic-ai/sdk';

export const SYSTEM_PROMPT = `You are an AI assistant that helps analyze LinkedIn messaging data. You have access to a local SQLite database containing the user's LinkedIn messages, connections, and relationship scores.

You can search contacts, messages, and get analytics. Be concise and helpful. When presenting data, use clear formatting with names, scores, and relevant details.

Key concepts:
- **Tier**: hot (≥55), warm (≥30), cold (<30) based on total_score
- **Total Score**: weighted from reciprocity (30%), recency (25%), frequency (20%), signal words (15%), depth (10%)
- **Signal Words**: mentions of "call", "meeting", "partnership", "collaborate", etc.
- **Reciprocity**: both sides messaging equally
- **One-way conversations are filtered out** (spam/unreplied messages)

When the user asks about contacts, always use the search tools to get real data. Don't guess or make up information.`;

export const TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_contacts',
    description: 'Search contacts by name, company, position, or tier. Returns scored leads matching the query.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search term for name, company, or position' },
        tier: { type: 'string', enum: ['hot', 'warm', 'cold', 'all'], description: 'Filter by tier' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
      required: [],
    },
  },
  {
    name: 'search_messages',
    description: 'Full-text search across message content. Returns messages matching the query with sender info.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search term for message content' },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_contact_detail',
    description: 'Get detailed info for a specific contact including score breakdown and recent messages.',
    input_schema: {
      type: 'object' as const,
      properties: {
        contact_id: { type: 'number', description: 'Contact ID' },
        name: { type: 'string', description: 'Contact name (used to look up if no ID)' },
      },
      required: [],
    },
  },
  {
    name: 'get_aggregate_stats',
    description: 'Get overview stats: tier counts, top leads, message trends, and network analysis.',
    input_schema: {
      type: 'object' as const,
      properties: {
        metric: {
          type: 'string',
          enum: ['overview', 'top_leads', 'companies', 'recent_activity', 'signal_summary'],
          description: 'Which metric to return',
        },
      },
      required: ['metric'],
    },
  },
];
