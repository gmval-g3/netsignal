# Multi-User Auth with Supabase Magic Links

## Context
NetSignal is currently a single-user app with zero auth. All data is global. The goal is to add email-based magic link login so the user and their co-founder each see only their own imported LinkedIn leads.

## Approach
- Supabase Auth with magic links (email only, no passwords)
- Add `user_id` to root tables (`ns_contacts`, `ns_settings`, `ns_chat_history`, `ns_tags`)
- Scope all API queries through user ownership
- Child tables (`ns_conversations`, `ns_messages`, `ns_lead_scores`, `ns_enriched_contacts`, `ns_contact_tags`) inherit scoping via their FK to `ns_contacts`
- `ns_company_enrichment` stays shared (company data is universal)

## Implementation

### 1. Install `@supabase/ssr`
```
npm install @supabase/ssr
```

### 2. Supabase Migration — Add `user_id` columns
```sql
ALTER TABLE ns_contacts ADD COLUMN user_id UUID REFERENCES auth.users(id);
CREATE INDEX idx_ns_contacts_user_id ON ns_contacts(user_id);
ALTER TABLE ns_contacts DROP CONSTRAINT IF EXISTS ns_contacts_linkedin_url_key;
ALTER TABLE ns_contacts ADD CONSTRAINT ns_contacts_user_linkedin_url_key UNIQUE (user_id, linkedin_url);

ALTER TABLE ns_settings ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE ns_settings DROP CONSTRAINT IF EXISTS ns_settings_key_key;
ALTER TABLE ns_settings ADD CONSTRAINT ns_settings_user_key_key UNIQUE (user_id, key);

ALTER TABLE ns_chat_history ADD COLUMN user_id UUID REFERENCES auth.users(id);

ALTER TABLE ns_tags ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE ns_tags DROP CONSTRAINT IF EXISTS ns_tags_name_key;
ALTER TABLE ns_tags ADD CONSTRAINT ns_tags_user_name_key UNIQUE (user_id, name);
```

### 3. New Files (5 files)

**`lib/db/supabase-server.ts`** — Cookie-based server client for API routes (reads auth session from cookies using `@supabase/ssr`)

**`lib/db/supabase-browser.ts`** — Browser client singleton for client components (login form, sign out)

**`lib/auth.ts`** — Helper: `getUser()` returns authenticated user from cookies, `requireUser()` throws on missing auth

**`middleware.ts`** — Refreshes auth session on every request, redirects unauthenticated users to `/login` (excludes `/login`, `/auth/callback`, and API routes)

**`app/auth/callback/route.ts`** — Handles magic link redirect: exchanges code for session, redirects to `/dashboard`

**`app/login/page.tsx`** — Email input form, calls `supabase.auth.signInWithOtp()`, shows "check your email" on success. Dark theme matching existing UI.

### 4. Modify `lib/db/supabase.ts`
- Keep as admin/service client (rename export to `getSupabaseAdmin`, alias `getSupabase` for backward compat)
- Ensure it reads the correct service role key env var

### 5. Modify API Routes — Add Auth + User Scoping

Every route gets `const user = await requireUser()` at the top and returns 401 JSON if not authenticated.

| Route | Scoping Strategy |
|-------|-----------------|
| `api/leads/route.ts` | Add `.eq('ns_contacts.user_id', user.id)` to `!inner` join |
| `api/stats/route.ts` | Filter contacts by `user_id`, messages/conversations via contacts join |
| `api/contacts/[id]/route.ts` | Add `.eq('user_id', user.id)` to contact fetch |
| `api/settings/route.ts` | Add `.eq('user_id', user.id)` to GET, include `user_id` in upsert |
| `api/tags/route.ts` | Add `.eq('user_id', user.id)` to GET/DELETE, include `user_id` in POST |
| `api/contacts/tags/route.ts` | Scope tag mappings query through contacts ownership |
| `api/leads/export/route.ts` | Add `.eq('ns_contacts.user_id', user.id)` to `buildCsv` query |
| `api/enrich/route.ts` | Verify contact ownership before enriching |
| `api/enrich-company/route.ts` | Auth check only (no scoping — shared data) |
| `api/import/route.ts` | **Most complex**: `clear` deletes only user's data chain, `contacts` adds `user_id`, `lookup` filters by `user_id`, scoring filters conversations to user's contacts |
| `api/chat/route.ts` | Pass `user.id` to `executeTool`, add user scoping to all 5 tool functions (`search_contacts`, `search_messages`, `get_contact_detail`, `get_aggregate_stats` with 5 sub-metrics, `signal_summary`) |

**Pattern for joins**: Queries using `ns_contacts!inner(...)` get `.eq('ns_contacts.user_id', user.id)` which filters the join.

**Pattern for deep joins** (messages → conversations → contacts): First fetch user's contact IDs, then filter with `.in('contact_id', contactIds)`.

### 6. Modify `components/layout/TopNav.tsx`
- Add sign-out button (LogOut icon) at right end of nav bar
- Uses browser Supabase client for `supabase.auth.signOut()`

### 7. Environment Variables
Need `NEXT_PUBLIC_SUPABASE_ANON_KEY` env var for client-side auth. The existing `SUPABASE_SERVICE_KEY` stays for admin operations.

## Files Summary
- **6 new files**: `lib/db/supabase-server.ts`, `lib/db/supabase-browser.ts`, `lib/auth.ts`, `middleware.ts`, `app/auth/callback/route.ts`, `app/login/page.tsx`
- **13 modified files**: All 11 API routes + `lib/db/supabase.ts` + `components/layout/TopNav.tsx`
- **1 SQL migration**

## Implementation Order
1. Install dep + env vars
2. SQL migration
3. New files (supabase clients, auth helper, middleware, login page, callback)
4. API routes (start with `settings` as simplest, then `import`, then rest)
5. TopNav sign-out
6. Build + test

## Verification
- `npm run build` — no type errors
- Open `/login` → enter email → receive magic link → click → land on `/dashboard`
- Import data as user A → see leads
- Log out → log in as user B → see empty dashboard → import user B's data → see only their leads
- Log back in as user A → still see only user A's leads
