# Halvex Matching Engine — Complete Specification

## Purpose

This spec describes the deal-to-Linear issue matching pipeline end-to-end.
It should be implementable from scratch by any engineer reading this document.

## Architecture Overview

```
Deal (with meeting notes)
  → Product Gap Extraction (4 sources)
    → For each gap:
      → Score against ALL Linear issues (vector + NLP hybrid)
        → Score ≥ 40: LINK to existing issue
        → Score < 40: CREATE new issue on Linear and link
  → After all deals: sync statuses from Linear cache
```

## Data Model

### Tables involved:
- `deal_logs` — deals with meeting_notes, note_signals_json, success_criteria
- `product_gaps` — curated product gaps (from analyze-notes endpoint)
- `linear_issues_cache` — synced Linear issues with embeddings
- `deal_linear_links` — the links between deals and Linear issues (loops)
- `linear_integrations` — Linear API keys per workspace

### Key columns:
- `deal_linear_links.link_type`: 'manual' | 'feature_gap'
- `deal_linear_links.status`: 'identified' | 'in_progress' | 'in_review' | 'in_cycle' | 'shipped'
- `deal_linear_links.addresses_risk`: text describing WHY this issue was matched (the gap text)
- `deal_linear_links.relevance_score`: integer 0-100 (match confidence)
- `linear_issues_cache.pgvector_embedding`: vector(1536) — OpenAI text-embedding-3-small
- `linear_issues_cache.embedding`: text — 336-dim TF-IDF (DO NOT USE for matching — wrong dimensions)
- `linear_issues_cache.cycle_id`: text — Linear cycle UUID
- `linear_issues_cache.cycle_number`: integer — Linear cycle number
- `linear_issues_cache.status`: text — e.g. "Todo", "In Progress", "In Review", "In QA", "Done"

## Function: `smartMatchAllDeals(workspaceId)`

### Step 1: Delete old auto-links
```sql
DELETE FROM deal_linear_links
WHERE workspace_id = $1 AND link_type != 'manual'
```
- Wipes ALL auto-generated links
- Manual links are ALWAYS preserved
- Fresh links will get correct statuses from the sync SQL at the end

### Step 2: Load all open deals
```sql
SELECT id FROM deal_logs
WHERE workspace_id = $1 AND stage NOT IN ('closed_won', 'closed_lost')
```

### Step 3: For each deal, call `smartMatchDeal(workspaceId, dealId)`

### Step 4: After ALL deals matched, sync statuses
```sql
UPDATE deal_linear_links dll
SET status = CASE
  WHEN lic.status IN ('Done', 'Completed') THEN 'shipped'
  WHEN lic.status = 'In Progress' THEN 'in_progress'
  WHEN lic.status = 'In Review' THEN 'in_review'
  WHEN lic.status IN ('In QA', 'RFQA', 'Started') THEN 'in_progress'
  WHEN lic.cycle_id IS NOT NULL THEN 'in_cycle'
  ELSE dll.status
END,
updated_at = NOW()
FROM linear_issues_cache lic
WHERE lic.linear_issue_id = dll.linear_issue_id
  AND lic.workspace_id = dll.workspace_id
  AND dll.workspace_id = $workspaceId
```

## Function: `smartMatchDeal(workspaceId, dealId)`

### Step 1: Load deal data
```sql
SELECT id, deal_name, prospect_company, meeting_notes, description, notes, deal_value
FROM deal_logs WHERE id = $dealId AND workspace_id = $workspaceId
```

### Step 2: Extract product gaps from 4 sources (in order)

**Source A: note_signals_json.product_gaps** (most common)
- Read from `deal_logs.note_signals_json`
- Parse JSON, extract `product_gaps` array
- Each gap has: `{ gap: string, quote?: string, severity?: string }`

**Source B: success_criteria** (short lines only)
- Split by newlines, filter to 15-100 char lines
- Skip lines starting with "if successful", "success criteria", "the poc", etc.
- Max 3 gaps from this source
- Deduplicate against Source A

**Source C: product_gaps table** (curated, workspace-wide)
- Query ALL open product gaps for this workspace (status NOT IN 'wont_fix', 'shipped')
- Include if: gap's source_deals contains this dealId, OR source_deals is empty (general gap)
- Deduplicate against existing gaps
- These are HIGH quality — severity 'high'

**Source D: Haiku extraction** (fallback, only if Sources A-C produced 0 gaps)
- Only runs if deal has meeting_notes/notes/description with > 50 chars
- REQUIRES: process.env.ANTHROPIC_API_KEY (log error if missing, don't crash)
- Call Claude Haiku with extraction prompt
- Store result in note_signals_json so it only runs once per deal
- Max 5 features per deal

### Step 3: Load Linear issues
```sql
SELECT linear_issue_id, title, description, linear_issue_url, status, priority, cycle_id
FROM linear_issues_cache WHERE workspace_id = $workspaceId
```
Filter out: titles < 8 chars, > 200 chars, cancelled/duplicate, meeting note patterns.

### Step 4: Load OpenAI embeddings
```sql
SELECT linear_issue_id, pgvector_embedding::text as pgvec
FROM linear_issues_cache
WHERE workspace_id = $workspaceId AND pgvector_embedding IS NOT NULL
```
**CRITICAL**: Read `pgvector_embedding` (1536-dim OpenAI), NOT `embedding` (336-dim TF-IDF).
Parse text format `[0.1,0.2,...]` into number arrays.

### Step 5: Load Linear integration for issue creation
```sql
SELECT api_key_enc, team_id FROM linear_integrations WHERE workspace_id = $workspaceId
```
Decrypt API key. If not available, log and continue (matching still works, creation doesn't).

### Step 6: For each gap, match or create

**6a: Try substring match first** (instant, no API)
- If gap text appears in any issue title (or vice versa): score = 95, done

**6b: Hybrid vector + NLP scoring**
- Embed the gap text using `generateEmbedding()` (OpenAI text-embedding-3-small, ~$0.00001)
- For each issue:
  - Vector score: `cosineSimilarity(gapEmbedding, issueEmbedding) * 100`
  - NLP score: `scoreMatch(gapText, issueTitle, issueDescription)` (native, no API)
  - Combined: `vecScore * 0.6 + nlpScore * 0.4` (or 100% NLP if no embeddings)
- Track best match and score

**6c: Product name conflict check** (for scores 40-59)
- Check if gap and issue mention different vendor/product names before keywords like "integration", "connector", "sync", "plugin", "api", "dashboard", "platform"
- If "X integration" vs "Y integration" where X ≠ Y and both > 3 chars: conflict detected → treat as no match

**6d: Decision**
- `score ≥ 40 AND no conflict`: LINK to existing issue
  - Insert into deal_linear_links with: linkType='feature_gap', status=linearStatusToLoopStatus(issue.status, issue.cycleId), addressesRisk=gapText
  - Check for existing link first (onConflictDoNothing)
- `score < 40 OR conflict`: CREATE new issue on Linear
  - Guard: gapText 10-150 chars, not a meeting note pattern
  - Call createIssue(linearApiKey, teamId, {title, description, priority})
  - Insert into linear_issues_cache
  - Insert into deal_linear_links with: linkType='feature_gap', status='identified', relevanceScore=100

### Step 7: Return results
```typescript
{ linked: number, created: number, dealName: string }
```

## Function: `linearStatusToLoopStatus(status, cycleId)`
```
null status + cycleId → 'in_cycle'
null status, no cycle → 'identified'
'Done'/'Completed' → 'shipped'
'In Progress' → 'in_progress'
'In Review' → 'in_review'
'In QA'/'RFQA'/'Started' → 'in_progress'
has cycleId → 'in_cycle'
else → 'identified'
```

## Function: `scoreMatch(gapText, issueTitle, issueDescription)`

Native NLP scoring (NO API calls). Returns 0-100.

### Signal 1: Stemmed keyword overlap (45% weight)
- Tokenize both: lowercase → expand hyphens → remove stop words → stem
- Count gap tokens that appear in issue title (2x weight) or description (1x weight)
- Score = (titleHits * 2 + descHits) / (gapTokens * 2) * 100

### Signal 2: Synonym expansion (35% weight)
- 50+ synonym groups covering domain terms
- For each unmatched gap token, check if any issue token is in the same synonym group
- Score = synonymHits / gapTokens * 100

### Signal 3: Bigram phrases (10% weight)
- Adjacent token pairs
- Score = bigramOverlap / gapBigrams * 100

### Signal 4: Character trigrams (10% weight)
- 3-char sliding window fuzzy match
- Score = trigramOverlap / max(gapTrigrams, issueTrigrams) * 100

### Guard
If totalHits < 2 AND combined < 40: return 0

## Error Handling

- **ANTHROPIC_API_KEY missing**: Log error, skip Haiku extraction, continue with other sources
- **OPENAI_API_KEY missing**: Log error, fall back to 100% NLP scoring
- **Linear API key invalid/expired**: Log error, skip creation, still link where possible
- **createIssue fails**: Log warning, continue to next gap
- **DB insert fails**: onConflictDoNothing, continue
- **Any per-deal error**: catch, log, continue to next deal

## Performance Constraints

- Vercel 60s function timeout
- ~16 deals × ~5 gaps × 1 embedding call = 80 calls (~$0.001)
- ~7 Haiku extraction calls (~$0.007)
- ~10 Linear createIssue calls (~10s)
- ~17,000 cosine similarity comparisons (~10ms)
- Total: ~40s within limit

## Testing Checklist

After rematch:
1. [ ] ALL product gaps in productGaps table either matched or created
2. [ ] "Appspace integration" → NEW Linear issue (not linked to GOS2-270)
3. [ ] "Tririga Integration" → NEW Linear issue
4. [ ] "Desk sensor ID visibility" → matched or created
5. [ ] Manual links (BOE 5, Atlassian 3) preserved
6. [ ] Statuses correct: In Progress → in_progress, In QA → in_progress, cycle + Todo → in_cycle
7. [ ] "Why Matched" column populated for all auto-links
8. [ ] Revenue deduplicated (BOE £216k once, not per-issue)
9. [ ] No "Suggested" or "Confirmed" labels anywhere
10. [ ] Total loops > 22 (was 22 before, should be higher with issue creation)
