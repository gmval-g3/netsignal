-- NetSignal: Full schema with user_id for multi-tenant isolation
-- Target: Supabase project irtugpizcydhyksvvptr

-- 1. ns_contacts
CREATE TABLE ns_contacts (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL,
  full_name text NOT NULL,
  first_name text,
  last_name text,
  linkedin_url text,
  email text,
  company text,
  position text,
  connected_on text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, linkedin_url)
);
CREATE INDEX idx_ns_contacts_user_id ON ns_contacts (user_id);

-- 2. ns_conversations
CREATE TABLE ns_conversations (
  id text NOT NULL,
  user_id uuid NOT NULL,
  contact_id integer REFERENCES ns_contacts(id),
  is_group boolean DEFAULT false,
  message_count integer DEFAULT 0,
  first_message_at text,
  last_message_at text,
  PRIMARY KEY (id),
  UNIQUE (user_id, id)
);
CREATE INDEX idx_ns_conversations_user_id ON ns_conversations (user_id);

-- 3. ns_messages
CREATE TABLE ns_messages (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL,
  conversation_id text REFERENCES ns_conversations(id),
  sender_name text,
  sender_url text,
  content text,
  sent_at text,
  is_from_user boolean DEFAULT false,
  has_signal_words boolean DEFAULT false,
  signal_words_found text
);
CREATE INDEX idx_ns_messages_user_id ON ns_messages (user_id);
CREATE INDEX idx_ns_messages_conversation_id ON ns_messages (conversation_id);

-- 4. ns_lead_scores
CREATE TABLE ns_lead_scores (
  contact_id integer NOT NULL REFERENCES ns_contacts(id),
  user_id uuid NOT NULL,
  reciprocity_score real DEFAULT 0,
  frequency_score real DEFAULT 0,
  depth_score real DEFAULT 0,
  signal_score real DEFAULT 0,
  recency_score real DEFAULT 0,
  total_score real DEFAULT 0,
  tier text DEFAULT 'cold',
  total_messages integer DEFAULT 0,
  user_messages integer DEFAULT 0,
  contact_messages integer DEFAULT 0,
  last_message_at text,
  last_message_preview text,
  UNIQUE (user_id, contact_id)
);
CREATE INDEX idx_ns_lead_scores_user_id ON ns_lead_scores (user_id);

-- 5. ns_tags
CREATE TABLE ns_tags (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text DEFAULT '#6366f1',
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, name)
);
CREATE INDEX idx_ns_tags_user_id ON ns_tags (user_id);

-- 6. ns_contact_tags
CREATE TABLE ns_contact_tags (
  contact_id integer NOT NULL REFERENCES ns_contacts(id),
  tag_id integer NOT NULL REFERENCES ns_tags(id),
  user_id uuid NOT NULL,
  PRIMARY KEY (user_id, contact_id, tag_id)
);

-- 7. ns_enriched_contacts
CREATE TABLE ns_enriched_contacts (
  contact_id integer NOT NULL REFERENCES ns_contacts(id),
  user_id uuid NOT NULL,
  headline text,
  bio text,
  current_title text,
  current_company text,
  company_url text,
  profile_picture_url text,
  location text,
  connections integer,
  followers integer,
  enriched_at timestamptz DEFAULT now(),
  UNIQUE (user_id, contact_id)
);

-- 8. ns_company_enrichment (shared, no user_id)
CREATE TABLE ns_company_enrichment (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_name text NOT NULL UNIQUE,
  revenue_estimate text,
  employee_estimate text,
  industry text,
  description text,
  confidence text DEFAULT 'low',
  enriched_at timestamptz DEFAULT now()
);

-- 9. ns_chat_history
CREATE TABLE ns_chat_history (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_ns_chat_history_user_id ON ns_chat_history (user_id);

-- 10. ns_settings
CREATE TABLE ns_settings (
  user_id uuid NOT NULL,
  key text NOT NULL,
  value text,
  PRIMARY KEY (user_id, key)
);
