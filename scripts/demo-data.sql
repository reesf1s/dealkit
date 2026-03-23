-- ============================================================================
-- Halvex Demo Workspace — Seed Data
-- Generated: 2026-03-23
-- Workspace: Halvex (pro plan)
-- User: rees@halvex.ai (user_3BLvFCWBVW66GwwmThixbRAyXyj)
-- ============================================================================
-- Usage:  psql $DATABASE_URL < scripts/demo-data.sql
-- Safety: All INSERTs use ON CONFLICT DO NOTHING so this is re-runnable.
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 0. Constants
-- ────────────────────────────────────────────────────────────────────────────
-- Workspace UUID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
-- User ID:        user_3BLvFCWBVW66GwwmThixbRAyXyj

-- ────────────────────────────────────────────────────────────────────────────
-- 1. User
-- ────────────────────────────────────────────────────────────────────────────

INSERT INTO users (id, email, created_at, updated_at)
VALUES (
  'user_3BLvFCWBVW66GwwmThixbRAyXyj',
  'rees@halvex.ai',
  NOW() - INTERVAL '90 days',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Workspace
-- ────────────────────────────────────────────────────────────────────────────

INSERT INTO workspaces (id, name, slug, owner_id, plan, pipeline_config, created_at, updated_at)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Halvex',
  'halvex-demo',
  'user_3BLvFCWBVW66GwwmThixbRAyXyj',
  'pro',
  '{
    "currency": "£",
    "valueDisplay": "annual",
    "stages": [
      { "id": "discovery",     "label": "Discovery",      "color": "#8B5CF6", "order": 1, "isDefault": true },
      { "id": "proposal",      "label": "Proposal",       "color": "#F59E0B", "order": 2, "isDefault": true },
      { "id": "qualification", "label": "Trial Phase",    "color": "#3B82F6", "order": 3, "isDefault": false },
      { "id": "prospecting",   "label": "Verbal Commit",  "color": "#10B981", "order": 4, "isDefault": false },
      { "id": "negotiation",   "label": "Negotiation",    "color": "#EF4444", "order": 5, "isDefault": true },
      { "id": "closed_won",    "label": "Closed Won",     "color": "#22C55E", "order": 6, "isDefault": true },
      { "id": "closed_lost",   "label": "Closed Lost",    "color": "#6B7280", "order": 7, "isDefault": true }
    ],
    "updatedAt": "2026-03-23T00:00:00.000Z"
  }'::jsonb,
  NOW() - INTERVAL '90 days',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Workspace Membership
-- ────────────────────────────────────────────────────────────────────────────

INSERT INTO workspace_memberships (workspace_id, user_id, role, created_at)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'user_3BLvFCWBVW66GwwmThixbRAyXyj',
  'owner',
  NOW() - INTERVAL '90 days'
)
ON CONFLICT ON CONSTRAINT workspace_memberships_workspace_id_user_id_unique DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Company Profile
-- ────────────────────────────────────────────────────────────────────────────

INSERT INTO company_profiles (workspace_id, user_id, company_name, website, industry, description, products, value_propositions, differentiators, common_objections, target_market, competitive_advantage, founded, employee_count)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'user_3BLvFCWBVW66GwwmThixbRAyXyj',
  'Halvex AI',
  'https://halvex.ai',
  'B2B SaaS — Sales Intelligence',
  'Halvex is an AI-powered deal intelligence platform that turns unstructured sales conversations into actionable pipeline insights. Our ML engine extracts buying signals, scores deal health, and generates battle-ready collateral — replacing hours of manual CRM hygiene with real-time intelligence.',
  '["DealKit — Deal Intelligence Platform", "Signal Engine — ML-powered conversion scoring", "Collateral Studio — AI-generated battlecards and one-pagers", "Pipeline Brain — Workspace-level pattern learning"]'::jsonb,
  '["3x faster deal insights vs manual pipeline reviews", "ML scoring catches at-risk deals CRMs miss", "Email forwarding + signal extraction saves 5+ hrs/week per rep", "Board-ready pipeline reports generated automatically", "Closed-deal playbooks improve win rates by 20%+"]'::jsonb,
  '["Text-first intelligence — works with emails, notes, and documents (no call recording required)", "Privacy-preserving ML that learns across your entire workspace", "Generates sales collateral directly from deal context", "Built for European B2B — GBP/EUR native, GDPR compliant", "Sub-60 second analysis turnaround on any deal update"]'::jsonb,
  '["We already use Gong/Clari — Halvex is text-first, complementary not competitive", "Our CRM already scores deals — CRM scoring is rule-based; Halvex uses ML on actual conversation signals", "Security concerns with AI reading our emails — SOC2 Type II, data never leaves your tenant, no training on customer data", "Too expensive for our team size — ROI typically 10x within 90 days from saved rep time alone"]'::jsonb,
  'B2B SaaS companies with 10-200 person sales teams, primarily in UK and Europe. Sweet spot: Series A to Series C companies with complex sales cycles (30-90 days) selling £20k-£200k ACV deals.',
  'Only platform that combines ML deal scoring with AI-generated sales collateral from the same intelligence layer. Competitors either do call recording (Gong) or pipeline forecasting (Clari) — Halvex does deal intelligence across all text-based touchpoints.',
  2024,
  '15'
)
ON CONFLICT ON CONSTRAINT company_profiles_workspace_id_key DO NOTHING;


-- ────────────────────────────────────────────────────────────────────────────
-- 5. Deals
-- ────────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- CLOSED WON DEALS (5)
-- ============================================================================

-- Deal 1: TechFlow Solutions — £48k — Closed Won
INSERT INTO deal_logs (
  workspace_id, user_id, deal_name, prospect_company, prospect_name, prospect_title,
  contacts, description, deal_value, stage, outcome, deal_type, recurring_interval,
  competitors, meeting_notes, ai_summary, conversion_score, intent_signals,
  todos, scheduled_events, close_date, won_date, win_reason,
  kanban_order, created_at, updated_at
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'user_3BLvFCWBVW66GwwmThixbRAyXyj',
  'TechFlow Solutions — Annual Platform License',
  'TechFlow Solutions',
  'Sarah Mitchell',
  'VP Sales',
  '[{"name":"Sarah Mitchell","role":"VP Sales","email":"s.mitchell@techflow.io"},{"name":"Dan Cooper","role":"Sales Operations Manager","email":"d.cooper@techflow.io"},{"name":"Raj Patel","role":"CTO","email":"r.patel@techflow.io"}]'::jsonb,
  'TechFlow Solutions is a mid-market SaaS company (Series B, ~80 employees) selling project management software. Their 25-person sales team was spending 6+ hours/week on manual pipeline reviews and CRM data entry. Sarah Mitchell championed the deal after seeing our demo at SaaStock London.',
  48000,
  'closed_won',
  'won',
  'recurring',
  'annual',
  '["HubSpot native reporting"]'::jsonb,
  E'## Discovery Call — 28 Jan 2026\nAttendees: Sarah Mitchell (VP Sales), Dan Cooper (Sales Ops Manager), Rees (Halvex)\n\nSarah opened by explaining their pipeline review process takes her entire Monday morning — manually pulling reports from HubSpot, cross-referencing with Slack threads, then writing summaries for her CRO. She estimated 6 hours/week across the team on "CRM hygiene."\n\nDan confirmed they''ve tried HubSpot''s native forecasting but found it "basically just weighted pipeline — no actual intelligence." They want something that reads their deal notes and tells them what''s actually happening.\n\nBudget: Sarah mentioned they have a £50k discretionary tools budget for Q1. Timeline: wants to be live before their QBR on March 15.\n\nKey buying signals:\n- Sarah asked about our API for HubSpot integration unprompted\n- Dan took detailed notes and asked for a technical spec doc\n- Both mentioned their CRO (James Liu) would need to sign off on anything over £30k\n\nNext steps: Send proposal + book demo with full sales team.\n\n---\n\n## Platform Demo — 4 Feb 2026\nAttendees: Sarah Mitchell, Dan Cooper, Raj Patel (CTO), + 4 sales reps\n\nRaj joined to evaluate security and data handling. Spent 15 minutes on our SOC2 compliance and data residency (UK-based). He was satisfied — said "this is more rigorous than most vendors we evaluate."\n\nDemo focused on:\n1. Email forwarding → automatic deal signal extraction\n2. ML conversion scoring on their actual pipeline shape\n3. Auto-generated weekly pipeline summary\n\nSarah''s reaction when she saw the auto-summary: "This is literally what I spend Monday mornings creating manually." Two of the reps immediately asked about the email forwarding setup.\n\nRaj asked about SSO — confirmed we support SAML. Dan asked about custom fields mapping to HubSpot properties.\n\nNext steps: Sarah to get budget approval from James Liu (CRO). Target sign-off by Feb 14.\n\n---\n\n## Negotiation & Close — 14 Feb 2026\nAttendees: Sarah Mitchell, Dan Cooper\n\nSarah confirmed James approved the spend. She negotiated for quarterly billing instead of annual upfront — we agreed to quarterly billing at the same annual rate (£48k/yr = £12k/quarter).\n\nDan asked for a 30-day onboarding support commitment — agreed, included in the package.\n\nContract signed same day. Sarah mentioned she wants to be a reference customer if the first quarter goes well.\n\n---\n\n## Post-Sale Check-in — 10 Mar 2026\nQuick 15-min call with Sarah. Pipeline reviews now take 45 minutes instead of 6 hours. She said "the conversion scores alone are worth the investment — we caught two deals slipping that we would have missed." Confirmed she''ll be a reference.',
  'TechFlow Solutions signed a £48k/yr annual platform license after a 45-day sales cycle. VP Sales Sarah Mitchell championed internally after manual pipeline reviews were consuming 6+ hours/week. Won against HubSpot native — key differentiator was ML-powered deal intelligence vs rule-based scoring. CTO approved after security review.',
  100,
  '{"champion":"Sarah Mitchell (VP Sales)","championConfirmed":true,"budgetStatus":"approved","budgetAmount":"£50k Q1 discretionary","timeline":"Before QBR March 15","decisionMaker":"James Liu (CRO)","nextMeeting":null,"buyingSignals":["Asked about API integration unprompted","Took detailed technical notes","Immediate rep interest in email forwarding","Reference customer offer"]}'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '2026-02-14T00:00:00Z',
  '2026-02-14T00:00:00Z',
  'Replaced manual pipeline reviews, 3x faster deal insights. Champion (Sarah Mitchell) experienced the pain firsthand and drove internal consensus quickly.',
  1,
  '2026-01-28T00:00:00Z',
  '2026-03-10T00:00:00Z'
);

-- Deal 2: Meridian Capital — £72k — Closed Won
INSERT INTO deal_logs (
  workspace_id, user_id, deal_name, prospect_company, prospect_name, prospect_title,
  contacts, description, deal_value, stage, outcome, deal_type, recurring_interval,
  competitors, meeting_notes, ai_summary, conversion_score, intent_signals,
  todos, scheduled_events, close_date, won_date, win_reason,
  kanban_order, created_at, updated_at
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'user_3BLvFCWBVW66GwwmThixbRAyXyj',
  'Meridian Capital — Enterprise Platform License',
  'Meridian Capital',
  'James Porter',
  'CRO',
  '[{"name":"James Porter","role":"CRO","email":"james.porter@meridiancap.com"},{"name":"Olivia Barnes","role":"Head of Sales Enablement","email":"o.barnes@meridiancap.com"},{"name":"Mark Stevens","role":"CFO","email":"m.stevens@meridiancap.com"}]'::jsonb,
  'Meridian Capital is a financial services firm (private equity advisory) with a 40-person business development team. James Porter (CRO) was referred by an investor who had seen Halvex in action. Their primary pain was deals falling through cracks in a fast-moving pipeline — they were losing ~£2M/quarter in preventable deal slippage.',
  72000,
  'closed_won',
  'won',
  'recurring',
  'annual',
  '["Clari", "People.ai"]'::jsonb,
  E'## Intro Call — 15 Jan 2026\nAttendees: James Porter (CRO), Olivia Barnes (Head of Sales Enablement), Rees (Halvex)\n\nJames was direct from the start: "We lost three deals last quarter that we thought were solid. Our CRM said they were on track, but the actual conversations told a different story." He wants a system that reads between the lines of deal communications.\n\nOlivia mentioned they evaluated Clari six months ago but found it "too focused on forecasting accuracy and not enough on deal-level intelligence." They also looked at People.ai but felt it was too focused on activity metrics rather than signal quality.\n\nBudget: James said this is a "board priority" — budget is pre-approved up to £100k for a deal intelligence solution. Timeline: wants a decision by end of February.\n\nKey signal: James asked if we could demo using their actual anonymised pipeline data. Very engaged.\n\n---\n\n## Deep-Dive Demo — 22 Jan 2026\nAttendees: James Porter, Olivia Barnes, + 6 senior BDs\n\nWe loaded a sanitised version of their pipeline (12 active deals) into a trial workspace. The ML scoring flagged 3 deals as high-risk that their CRM had marked as "on track." James went quiet for about 10 seconds, then said: "Two of those three — I was just about to bring them up in our pipeline review as concerns. The third one I didn''t even know about."\n\nOlivia was particularly impressed by the intent signal extraction: "We have all this information buried in email threads that nobody reads. This surfaces it automatically."\n\nThe BD team asked about mobile access and Slack notifications. One senior BD (Tom) said he would "start forwarding every client email today if we had this."\n\nCompetitor comparison: James confirmed Clari was still in consideration but said "you''re solving a different problem — Clari tells me the forecast is wrong, you tell me which deals to save and how."\n\n---\n\n## Proposal Review — 5 Feb 2026\nAttendees: James Porter, Mark Stevens (CFO)\n\nMark joined to review the commercial terms. He challenged the pricing — asked for a volume discount given their team size. We proposed £72k/yr (down from £84k list) with a 2-year commitment. Mark accepted.\n\nJames confirmed: "We''re going with Halvex. The demo with our own data sealed it. Clari is off the table."\n\nContract signed 14 Feb. 60-day cycle from first touch.\n\n---\n\n## Onboarding Kickoff — 20 Feb 2026\nSmooth onboarding. Olivia is running the internal rollout. 15 BDs active in week one, full team by end of March. James scheduled a 90-day review for mid-May.',
  'Meridian Capital signed a £72k/yr enterprise license after a 60-day cycle. CRO James Porter championed after our ML scoring caught 3 at-risk deals their CRM had marked on track — a live proof point during the demo. Won against Clari (forecasting focus) and People.ai (activity metrics). CFO Mark Stevens approved after 2-year commitment pricing.',
  100,
  '{"champion":"James Porter (CRO)","championConfirmed":true,"budgetStatus":"approved","budgetAmount":"£100k pre-approved (board priority)","timeline":"Decision by end of Feb","decisionMaker":"Mark Stevens (CFO) for commercial terms","nextMeeting":null,"buyingSignals":["Board-level priority","Asked to demo with own data","Competitor explicitly ruled out","Full team interest from day one"]}'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '2026-02-14T00:00:00Z',
  '2026-02-14T00:00:00Z',
  'ML scoring caught 3 at-risk deals their CRM missed. Live demo with their own data created an undeniable proof point. Won against Clari on deal-level intelligence vs forecast-level.',
  2,
  '2026-01-15T00:00:00Z',
  '2026-02-20T00:00:00Z'
);

-- Deal 3: NovaBridge Labs — £36k — Closed Won
INSERT INTO deal_logs (
  workspace_id, user_id, deal_name, prospect_company, prospect_name, prospect_title,
  contacts, description, deal_value, stage, outcome, deal_type, recurring_interval,
  competitors, meeting_notes, ai_summary, conversion_score, intent_signals,
  todos, scheduled_events, close_date, won_date, win_reason,
  kanban_order, created_at, updated_at
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'user_3BLvFCWBVW66GwwmThixbRAyXyj',
  'NovaBridge Labs — Growth Plan',
  'NovaBridge Labs',
  'Lisa Chen',
  'Head of RevOps',
  '[{"name":"Lisa Chen","role":"Head of RevOps","email":"lisa.chen@novabridge.io"},{"name":"Amir Hussain","role":"VP Sales","email":"a.hussain@novabridge.io"}]'::jsonb,
  'NovaBridge Labs is a biotech data analytics startup (Series A, 30 employees). Lisa Chen runs a lean 12-person sales team and was overwhelmed by the volume of deal communications flowing through email. She found Halvex through a LinkedIn post about email signal extraction.',
  36000,
  'closed_won',
  'won',
  'recurring',
  'annual',
  '[]'::jsonb,
  E'## Discovery Call — 10 Feb 2026\nAttendees: Lisa Chen (Head of RevOps), Rees (Halvex)\n\nLisa was refreshingly direct: "I saw your LinkedIn post about extracting buying signals from forwarded emails and I thought — that''s exactly what I need. My reps send me email threads and I spend hours reading through them to understand deal status."\n\nHer team does most of their selling via email (biotech buyers don''t do many video calls). She estimated she personally spends 5+ hours/week just reading rep email threads to stay on top of the pipeline.\n\nBudget: Lisa has a £40k annual tools budget. No other stakeholders needed for approval under that threshold.\n\nTimeline: "I want this yesterday." Very short buying cycle expected.\n\n---\n\n## Live Setup Session — 17 Feb 2026\nAttendees: Lisa Chen, Amir Hussain (VP Sales)\n\nInstead of a traditional demo, we did a live setup. Lisa forwarded 5 active deal email threads during the call. Within 3 minutes, the platform had extracted contacts, buying signals, timeline mentions, and competitor references from all 5.\n\nLisa''s exact words: "This just saved me an entire afternoon." Amir was watching over her shoulder and said "Can all the reps do this?"\n\nWe set up the email forwarding address for the whole team on the spot. Lisa said she''d send the contract request to finance that afternoon.\n\n---\n\n## Contract Signed — 12 Mar 2026\nLisa signed within 30 days of first contact. Fastest close in our pipeline. She''s already forwarding 20+ emails/day. Said the time savings alone justify the cost — "5 hours/week back is worth way more than £36k."',
  'NovaBridge Labs signed a £36k/yr growth plan in just 30 days. Head of RevOps Lisa Chen championed after email forwarding + signal extraction saved her 5+ hours/week of manual email thread review. No competitors in the deal — Halvex was the only solution addressing their text-first workflow. Biotech sales teams do most selling via email, making Halvex a natural fit.',
  100,
  '{"champion":"Lisa Chen (Head of RevOps)","championConfirmed":true,"budgetStatus":"approved","budgetAmount":"£40k annual tools budget","timeline":"Immediate — wanted it yesterday","decisionMaker":"Lisa Chen (sole decision maker under £40k)","nextMeeting":null,"buyingSignals":["Inbound lead from content marketing","Immediate pain recognition","Live setup during demo call","Same-day contract request"]}'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '2026-03-12T00:00:00Z',
  '2026-03-12T00:00:00Z',
  'Email forwarding + signal extraction saved 5hrs/week. Fastest close — Lisa experienced the value live during the setup session.',
  3,
  '2026-02-10T00:00:00Z',
  '2026-03-12T00:00:00Z'
);

-- Deal 4: Apex Dynamics — £96k — Closed Won
INSERT INTO deal_logs (
  workspace_id, user_id, deal_name, prospect_company, prospect_name, prospect_title,
  contacts, description, deal_value, stage, outcome, deal_type, recurring_interval,
  competitors, meeting_notes, ai_summary, conversion_score, intent_signals,
  todos, scheduled_events, close_date, won_date, win_reason,
  kanban_order, created_at, updated_at
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'user_3BLvFCWBVW66GwwmThixbRAyXyj',
  'Apex Dynamics — Enterprise License + Board Reporting',
  'Apex Dynamics',
  'Michael Ross',
  'SVP Revenue',
  '[{"name":"Michael Ross","role":"SVP Revenue","email":"m.ross@apexdynamics.co.uk"},{"name":"Catherine Webb","role":"Director of Sales","email":"c.webb@apexdynamics.co.uk"},{"name":"Paul Henderson","role":"CEO","email":"p.henderson@apexdynamics.co.uk"},{"name":"Nina Kaur","role":"Head of Finance","email":"n.kaur@apexdynamics.co.uk"}]'::jsonb,
  'Apex Dynamics is a UK industrial automation company (£50M revenue, 200 employees) with a 60-person commercial team. Michael Ross needed board-ready pipeline reports that didn''t require a week of manual preparation. Complex enterprise deal with 4 stakeholders and full procurement process.',
  96000,
  'closed_won',
  'won',
  'recurring',
  'annual',
  '["Clari", "HubSpot native reporting"]'::jsonb,
  E'## Initial Meeting — 20 Dec 2025\nAttendees: Michael Ross (SVP Revenue), Catherine Webb (Director of Sales), Rees (Halvex)\n\nMichael explained the problem: every board meeting requires a pipeline report that takes Catherine''s team a full week to compile. They pull data from HubSpot, cross-reference with rep notes, manually calculate stage probabilities, and format everything into a board deck. "It''s a week of work that produces a snapshot that''s already stale by the time the board sees it."\n\nCatherine added that they tried Clari for forecasting but the board wanted more than forecast accuracy — they wanted narrative context around why deals were moving or stalling.\n\nBudget: Michael indicated £80-100k is realistic. Needs CEO and Head of Finance approval. Timeline: wants to have something in place before the April board meeting.\n\n---\n\n## Technical Deep-Dive — 8 Jan 2026\nAttendees: Michael Ross, Catherine Webb, IT Security Lead (reviewed via async)\n\nDetailed walkthrough of board report generation. We showed how the platform auto-generates narrative pipeline summaries with deal movement highlights, risk flags, and win/loss analysis. Michael said: "This is exactly what I spend a week building in PowerPoint."\n\nSecurity review completed async — IT cleared us after reviewing our SOC2 documentation and data processing agreement.\n\nCatherine asked about customising the board report template to match their brand guidelines. We confirmed this is possible.\n\n---\n\n## Proposal & Stakeholder Alignment — 22 Jan 2026\nAttendees: Michael Ross, Paul Henderson (CEO), Nina Kaur (Head of Finance)\n\nPresented to the CEO and finance. Paul was initially sceptical ("another AI tool") but changed tone when Michael showed him the auto-generated board summary from their trial data. Paul said: "If this is what I''d see every month, that alone is worth it."\n\nNina challenged on ROI — we walked through the time savings calculation: 5 days/month x 12 months = 60 person-days/year. At their loaded cost rate, that''s ~£180k in saved time. £96k investment for £180k in savings.\n\nNina approved the spend on the spot.\n\n---\n\n## Contract Execution — 20 Mar 2026\nProcurement took 8 weeks (standard for Apex). Contract signed for £96k/yr with annual review. Michael confirmed he''ll present the first AI-generated board report at the April meeting. 90-day total cycle.',
  'Apex Dynamics signed a £96k/yr enterprise license after a 90-day cycle involving CEO and CFO. SVP Revenue Michael Ross championed after board-ready pipeline reports eliminated a week of manual preparation per month. ROI justified: 60 person-days/year saved (~£180k) for £96k investment. Won against Clari (forecast-only, no narrative) and HubSpot native (manual process).',
  100,
  '{"champion":"Michael Ross (SVP Revenue)","championConfirmed":true,"budgetStatus":"approved","budgetAmount":"£80-100k range","timeline":"Before April board meeting","decisionMaker":"Paul Henderson (CEO) and Nina Kaur (Head of Finance)","nextMeeting":null,"buyingSignals":["CEO converted from sceptic during demo","CFO approved on the spot after ROI calc","Week-long manual process = strong pain","Board-level visibility requirement"]}'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '2026-03-20T00:00:00Z',
  '2026-03-20T00:00:00Z',
  'Board-ready pipeline reports generated automatically. CEO converted after seeing auto-generated summary. ROI: £180k saved time vs £96k cost.',
  4,
  '2025-12-20T00:00:00Z',
  '2026-03-20T00:00:00Z'
);

-- Deal 5: CloudScale UK — £54k — Closed Won
INSERT INTO deal_logs (
  workspace_id, user_id, deal_name, prospect_company, prospect_name, prospect_title,
  contacts, description, deal_value, stage, outcome, deal_type, recurring_interval,
  competitors, meeting_notes, ai_summary, conversion_score, intent_signals,
  todos, scheduled_events, close_date, won_date, win_reason,
  kanban_order, created_at, updated_at
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'user_3BLvFCWBVW66GwwmThixbRAyXyj',
  'CloudScale UK — Platform License',
  'CloudScale UK',
  'Emma Watson',
  'Sales Director',
  '[{"name":"Emma Watson","role":"Sales Director","email":"emma.watson@cloudscale.co.uk"},{"name":"Ben Crawford","role":"Account Executive Team Lead","email":"b.crawford@cloudscale.co.uk"}]'::jsonb,
  'CloudScale UK is a cloud infrastructure reseller (Series B, 50 employees) with a 20-person sales team. Emma Watson was focused on improving win rates after a tough Q4. She wanted to extract playbooks from their closed-won deals and apply the patterns to active pipeline.',
  54000,
  'closed_won',
  'won',
  'recurring',
  'annual',
  '["Gong"]'::jsonb,
  E'## Discovery Call — 3 Feb 2026\nAttendees: Emma Watson (Sales Director), Rees (Halvex)\n\nEmma''s team had a 28% win rate in Q4, down from 35% the year before. She believes the issue is inconsistent selling — her top reps close at 45% but the rest of the team is at 22%. She wants to extract what the top performers do differently and codify it.\n\nShe looked at Gong but her team doesn''t do many video calls — most of their selling is through proposals, emails, and Slack messages with channel partners. "Gong is great if you''re on Zoom all day, but that''s not us."\n\nBudget: £60k available. Timeline: wants to start extracting playbooks from Q4 closed deals immediately.\n\n---\n\n## Demo & Playbook Workshop — 10 Feb 2026\nAttendees: Emma Watson, Ben Crawford (AE Team Lead)\n\nWe loaded their last 8 closed-won deals and demonstrated the pattern extraction. The platform identified common winning patterns: multi-threading (avg 3.2 contacts on won deals vs 1.4 on lost), early technical validation, and specific value props that resonated.\n\nBen got excited: "I can literally see what I do differently from the junior reps. This is like having a coaching playbook that writes itself."\n\nEmma asked about sharing playbook insights with the team — we showed the collateral generation feature that turns winning patterns into talk tracks and email templates.\n\n---\n\n## Close — 14 Mar 2026\nEmma signed at £54k/yr (40-day cycle). Already reporting that reps are using generated talk tracks in their outreach. Early signal: win rate for March is trending at 33% — up from 28% in Q4.',
  'CloudScale UK signed a £54k/yr license in 40 days. Sales Director Emma Watson championed after pattern extraction from closed deals revealed specific winning behaviours. Playbook generation from closed-deal analysis projected to improve win rate by 22% (Q4 28% trending to 33%+ in March). Won against Gong — CloudScale sells via text not calls.',
  100,
  '{"champion":"Emma Watson (Sales Director)","championConfirmed":true,"budgetStatus":"approved","budgetAmount":"£60k available","timeline":"Immediate","decisionMaker":"Emma Watson (sole authority)","nextMeeting":null,"buyingSignals":["Win rate decline creating urgency","Team lead immediately engaged","Gong ruled out — text-first workflow","Quick decision cycle — sole authority"]}'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '2026-03-14T00:00:00Z',
  '2026-03-14T00:00:00Z',
  'Playbook from closed deals improved win rate by 22%. Text-first approach won over Gong. AE Team Lead became internal advocate on day one.',
  5,
  '2026-02-03T00:00:00Z',
  '2026-03-14T00:00:00Z'
);


-- ============================================================================
-- CLOSED LOST DEALS (3)
-- ============================================================================

-- Deal 6: Ironforge Industries — £120k — Closed Lost
INSERT INTO deal_logs (
  workspace_id, user_id, deal_name, prospect_company, prospect_name, prospect_title,
  contacts, description, deal_value, stage, outcome, deal_type, recurring_interval,
  competitors, meeting_notes, ai_summary, conversion_score, intent_signals,
  todos, scheduled_events, close_date, lost_date, lost_reason, competitor_lost_to,
  kanban_order, created_at, updated_at
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'user_3BLvFCWBVW66GwwmThixbRAyXyj',
  'Ironforge Industries — Enterprise Platform',
  'Ironforge Industries',
  'Richard Hayes',
  'VP Revenue Operations',
  '[{"name":"Richard Hayes","role":"VP Revenue Operations","email":"r.hayes@ironforge.com"},{"name":"Sandra Kim","role":"CRO","email":"s.kim@ironforge.com"},{"name":"Trevor Walsh","role":"Sales Enablement Lead","email":"t.walsh@ironforge.com"}]'::jsonb,
  'Ironforge Industries is a manufacturing tech company with a 100-person sales org. They were evaluating multiple revenue intelligence platforms. The deal looked strong early but their primary need turned out to be call recording and analysis, where Gong had a clear advantage.',
  120000,
  'closed_lost',
  'lost',
  'recurring',
  'annual',
  '["Gong"]'::jsonb,
  E'## Discovery Call — 5 Jan 2026\nAttendees: Richard Hayes (VP RevOps), Trevor Walsh (Sales Enablement Lead), Rees (Halvex)\n\nRichard outlined their evaluation criteria: they want a platform that captures and analyses every customer interaction. Their reps do 80% of selling via video calls (Zoom/Teams). Richard specifically mentioned wanting call recording, transcription, and automated coaching.\n\nTrevor asked about our call recording capabilities — we explained that Halvex is text-first and doesn''t do call recording. He seemed disappointed but said they would still evaluate us for the text analysis side.\n\nBudget: £120-150k approved. 5-vendor shortlist. Decision by end of March.\n\n---\n\n## Demo — 15 Jan 2026\nAttendees: Richard Hayes, Sandra Kim (CRO), Trevor Walsh\n\nSandra was impressed by our ML scoring and signal extraction but kept circling back to calls: "90% of our deal intelligence is in Zoom recordings. Can you analyse those?" We explained our roadmap for call integration but it''s 6+ months out.\n\nSandra was candid: "Your text analysis is genuinely best-in-class. But if I have to pick one tool, it needs to cover calls because that''s where our data lives."\n\n---\n\n## Loss Notification — 20 Mar 2026\nRichard emailed to confirm they chose Gong. He was complimentary: "If we were a text-heavy sales team, you''d have won. But our workflow is 80% calls and Gong covers both calls and basic text. Wish you had call recording — we''d have gone with you."\n\nGood loss — clear product gap, not a competitive failure on our core offering.',
  'Lost Ironforge Industries (£120k) to Gong after 75-day evaluation. Their sales team is 80% video calls and call recording was the primary requirement. Halvex text analysis was acknowledged as superior, but Gong covered their dominant use case. Clear product gap — call recording on our roadmap but 6+ months out.',
  0,
  '{"champion":"Richard Hayes (VP RevOps)","championConfirmed":false,"budgetStatus":"approved","budgetAmount":"£120-150k","timeline":"Decision by end of March","decisionMaker":"Sandra Kim (CRO)","nextMeeting":null,"buyingSignals":["Large approved budget","Multi-vendor evaluation","CRO engaged early"]}'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '2026-03-20T00:00:00Z',
  '2026-03-20T00:00:00Z',
  'Chose competitor (Gong) — wanted call recording not text analysis. Their workflow is 80% video calls. Halvex text analysis praised as best-in-class but couldn''t cover their primary use case.',
  'Gong',
  1,
  '2026-01-05T00:00:00Z',
  '2026-03-20T00:00:00Z'
);

-- Deal 7: BlueHorizon Media — £24k — Closed Lost
INSERT INTO deal_logs (
  workspace_id, user_id, deal_name, prospect_company, prospect_name, prospect_title,
  contacts, description, deal_value, stage, outcome, deal_type, recurring_interval,
  competitors, meeting_notes, ai_summary, conversion_score, intent_signals,
  todos, scheduled_events, close_date, lost_date, lost_reason,
  kanban_order, created_at, updated_at
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'user_3BLvFCWBVW66GwwmThixbRAyXyj',
  'BlueHorizon Media — Starter Plan',
  'BlueHorizon Media',
  'Chris Morgan',
  'Head of Sales',
  '[{"name":"Chris Morgan","role":"Head of Sales","email":"c.morgan@bluehorizon.media"},{"name":"Amy Liu","role":"Finance Director","email":"a.liu@bluehorizon.media"}]'::jsonb,
  'BlueHorizon Media is a digital media agency with a small sales team (8 people). Chris Morgan was enthusiastic about Halvex but the company implemented a budget freeze on all new tooling after a difficult Q4.',
  24000,
  'closed_lost',
  'lost',
  'recurring',
  'annual',
  '[]'::jsonb,
  E'## Discovery Call — 25 Feb 2026\nAttendees: Chris Morgan (Head of Sales), Rees (Halvex)\n\nChris was a warm inbound lead — downloaded our email signal extraction whitepaper and booked a call immediately. Very enthusiastic about the platform. His team of 8 reps manages ~40 active deals and he struggles to stay on top of all of them.\n\nBudget: Chris mentioned £25-30k was available in his tools budget. Timeline: wanted to start in March.\n\nGood fit, good champion, clear need.\n\n---\n\n## Budget Freeze Notification — 17 Mar 2026\nChris emailed apologetically: "Bad news — Amy (our Finance Director) just announced a company-wide freeze on all new software purchases. Q4 revenue was below target and the board wants to conserve cash until Q3. I''m gutted because I really wanted this, but my hands are tied."\n\nI responded offering to hold his pricing and restart the conversation in Q3. Chris said he''d be in touch July.',
  'Lost BlueHorizon Media (£24k) after just 20 days — company-wide budget freeze following a weak Q4. Champion Chris Morgan was enthusiastic and the deal was a strong fit, but Finance Director imposed a freeze on all new tooling until Q3. Pricing held for Q3 restart.',
  0,
  '{"champion":"Chris Morgan (Head of Sales)","championConfirmed":true,"budgetStatus":"frozen","budgetAmount":"£25-30k (frozen until Q3)","timeline":"Postponed to Q3 2026","decisionMaker":"Amy Liu (Finance Director) — imposed freeze","nextMeeting":null,"buyingSignals":["Inbound lead from content","Enthusiastic champion","Clear use case fit"]}'::jsonb,
  '[{"text":"Follow up with Chris Morgan in July for Q3 restart","completed":false,"createdAt":"2026-03-17T00:00:00Z"}]'::jsonb,
  '[]'::jsonb,
  '2026-03-17T00:00:00Z',
  '2026-03-17T00:00:00Z',
  'Budget frozen — postponed all new tooling to Q3. Champion was enthusiastic but finance imposed company-wide freeze after weak Q4 revenue.',
  2,
  '2026-02-25T00:00:00Z',
  '2026-03-17T00:00:00Z'
);

-- Deal 8: Quantum Retail — £60k — Closed Lost
INSERT INTO deal_logs (
  workspace_id, user_id, deal_name, prospect_company, prospect_name, prospect_title,
  contacts, description, deal_value, stage, outcome, deal_type, recurring_interval,
  competitors, meeting_notes, ai_summary, conversion_score, intent_signals,
  todos, scheduled_events, close_date, lost_date, lost_reason,
  kanban_order, created_at, updated_at
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'user_3BLvFCWBVW66GwwmThixbRAyXyj',
  'Quantum Retail — Platform License',
  'Quantum Retail',
  'Daniel Shaw',
  'VP Sales',
  '[{"name":"Daniel Shaw","role":"VP Sales","email":"d.shaw@quantumretail.com"},{"name":"Fiona Clarke","role":"CTO","email":"f.clarke@quantumretail.com"},{"name":"George Adams","role":"Head of Engineering","email":"g.adams@quantumretail.com"}]'::jsonb,
  'Quantum Retail is an e-commerce platform company with 30 sales reps. The deal progressed well through discovery and demo but was ultimately killed by the CTO who wanted to build an internal solution using their existing data engineering team.',
  60000,
  'closed_lost',
  'lost',
  'recurring',
  'annual',
  '[]'::jsonb,
  E'## Discovery Call — 28 Jan 2026\nAttendees: Daniel Shaw (VP Sales), Rees (Halvex)\n\nDaniel was referred by a contact at TechFlow Solutions. His team runs a fast-paced sales operation (30 reps, 200+ active deals) and he struggles with pipeline visibility. "I don''t trust our CRM data because reps don''t update it consistently."\n\nBudget: £50-70k available. Timeline: Q1 decision preferred.\n\n---\n\n## Demo with CTO — 10 Feb 2026\nAttendees: Daniel Shaw, Fiona Clarke (CTO), George Adams (Head of Engineering)\n\nFiona attended to evaluate the technical approach. She was clearly evaluating whether they could build this internally. She asked very specific questions about our NLP models, embedding approach, and scoring methodology.\n\nGeorge mentioned they have "a strong data engineering team that could probably build something similar." Daniel pushed back: "We''ve been saying we''d build internal tools for years and never do."\n\nFiona was non-committal: "Interesting technology. Let me think about the build vs buy analysis."\n\nRed flag: CTO evaluating build-vs-buy, not evaluating our product.\n\n---\n\n## Loss — 18 Mar 2026\nDaniel called to deliver the news: "Fiona convinced the CEO to allocate two engineers to build a custom pipeline intelligence tool. She thinks they can do it in 3 months for less than our annual license. I disagreed but I was overruled."\n\nClassic build-vs-buy loss. Worth following up in 6 months when their internal project inevitably stalls.',
  'Lost Quantum Retail (£60k) to an internal build decision after 50 days. CTO Fiona Clarke opted to allocate engineering resources to build a custom solution rather than buy. VP Sales Daniel Shaw was a strong champion but was overruled. Common pattern — worth following up in 6 months when internal build timeline slips.',
  0,
  '{"champion":"Daniel Shaw (VP Sales)","championConfirmed":true,"budgetStatus":"approved","budgetAmount":"£50-70k","timeline":"Q1 decision","decisionMaker":"Fiona Clarke (CTO) — made build decision","nextMeeting":null,"buyingSignals":["Referral from existing customer","Strong champion","Clear pipeline visibility pain"]}'::jsonb,
  '[{"text":"Follow up with Daniel Shaw in September — check if internal build delivered","completed":false,"createdAt":"2026-03-18T00:00:00Z"}]'::jsonb,
  '[]'::jsonb,
  '2026-03-18T00:00:00Z',
  '2026-03-18T00:00:00Z',
  'Internal build — CTO wanted custom solution. Allocated 2 engineers to build in-house rather than buy. VP Sales champion was overruled.',
  3,
  '2026-01-28T00:00:00Z',
  '2026-03-18T00:00:00Z'
);


-- ============================================================================
-- ACTIVE DEALS — Discovery (3)
-- ============================================================================

-- Deal 9: Sentinel Security — Discovery — £84k
INSERT INTO deal_logs (
  workspace_id, user_id, deal_name, prospect_company, prospect_name, prospect_title,
  contacts, description, deal_value, stage, deal_type, recurring_interval,
  competitors, meeting_notes, ai_summary, conversion_score, intent_signals,
  todos, scheduled_events, close_date,
  kanban_order, created_at, updated_at
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'user_3BLvFCWBVW66GwwmThixbRAyXyj',
  'Sentinel Security — Enterprise Evaluation',
  'Sentinel Security',
  'David Park',
  'VP Sales Ops',
  '[{"name":"David Park","role":"VP Sales Ops","email":"d.park@sentinelsec.io"},{"name":"Karen White","role":"CISO","email":"k.white@sentinelsec.io"}]'::jsonb,
  'Sentinel Security is a cybersecurity firm (Series C, 150 employees) with a 45-person sales team. David Park attended our webinar on deal intelligence and booked an intro call. Early stage — had first meeting, need to understand their specific requirements around security and compliance.',
  84000,
  'discovery',
  'recurring',
  'annual',
  '["Gong", "Clari"]'::jsonb,
  E'## Intro Call — 18 Mar 2026\nAttendees: David Park (VP Sales Ops), Rees (Halvex)\n\nDavid attended our "Pipeline Intelligence in 2026" webinar last week and was intrigued. Sentinel has a 45-person sales team selling cybersecurity products to enterprises — complex deals, long cycles (90-120 days), typically £200-500k ACV.\n\nDavid''s pain: "We have Salesforce as our CRM but the data quality is terrible. Reps don''t update opportunities and I have no real visibility into what''s happening in deals until the forecast call every Monday."\n\nHe mentioned they briefly looked at Gong but had concerns about recording sensitive security discussions with clients. "Our clients are CISOs — they''re not going to let us record calls." This makes Halvex''s text-first approach very appealing.\n\nDavid also mentioned Karen White (CISO) would need to approve any tool that handles customer communication data. Security review will be critical.\n\nBudget: David said £80-100k is realistic for the right tool. No formal evaluation process started yet.\n\nNext steps: David to check internal calendar and book a deeper discovery session with 2-3 reps present.',
  'Early-stage opportunity with Sentinel Security (£84k). VP Sales Ops David Park attended our webinar and has clear pipeline visibility pain. Cybersecurity firm where call recording is a non-starter (clients are CISOs), making Halvex text-first approach a strong fit. CISO approval required for security review. Next: deeper discovery session with reps.',
  32,
  '{"champion":"David Park (VP Sales Ops)","championConfirmed":false,"budgetStatus":"indicative","budgetAmount":"£80-100k realistic","timeline":"No formal timeline yet","decisionMaker":"Karen White (CISO) for security approval","nextMeeting":"2026-03-28","buyingSignals":["Webinar attendee — self-qualified","Call recording concerns favour us","Clear CRM data quality pain","Budget indication given early"]}'::jsonb,
  '[{"text":"Send Sentinel Security our SOC2 report and security whitepaper ahead of CISO review","completed":false,"createdAt":"2026-03-18T00:00:00Z"},{"text":"Prepare cybersecurity-specific demo showing sensitive data handling","completed":false,"createdAt":"2026-03-18T00:00:00Z"},{"text":"Book deeper discovery session with David + 2-3 reps","completed":false,"createdAt":"2026-03-18T00:00:00Z"}]'::jsonb,
  '[{"title":"Discovery Session with Sales Reps","date":"2026-03-28T14:00:00Z","type":"meeting","attendees":["David Park","Rees"],"notes":"Deep dive into current workflow, bring 2-3 reps"}]'::jsonb,
  '2026-05-30T00:00:00Z',
  1,
  '2026-03-18T00:00:00Z',
  '2026-03-23T00:00:00Z'
);

-- Deal 10: Pinnacle Health — Discovery — £42k
INSERT INTO deal_logs (
  workspace_id, user_id, deal_name, prospect_company, prospect_name, prospect_title,
  contacts, description, deal_value, stage, deal_type, recurring_interval,
  competitors, meeting_notes, ai_summary, conversion_score, intent_signals,
  todos, scheduled_events, close_date,
  kanban_order, created_at, updated_at
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'user_3BLvFCWBVW66GwwmThixbRAyXyj',
  'Pinnacle Health — Growth Plan Evaluation',
  'Pinnacle Health',
  'Rachel Green',
  'RevOps Lead',
  '[{"name":"Rachel Green","role":"RevOps Lead","email":"r.green@pinnaclehealth.co.uk"},{"name":"Simon Bell","role":"VP Sales","email":"s.bell@pinnaclehealth.co.uk"}]'::jsonb,
  'Pinnacle Health is a health-tech company selling patient engagement software to NHS trusts and private clinics. Rachel Green is exploring deal intelligence options to help their 15-person sales team manage longer NHS procurement cycles.',
  42000,
  'discovery',
  'recurring',
  'annual',
  '["HubSpot native reporting"]'::jsonb,
  E'## Intro Call — 20 Mar 2026\nAttendees: Rachel Green (RevOps Lead), Rees (Halvex)\n\nRachel found us through a Google search for "deal intelligence UK." She manages RevOps for a 15-person team selling into the NHS — extremely long cycles (6-12 months) with complex procurement.\n\nHer challenge: "NHS deals have so many stakeholders and touch points that we lose track of what''s been said to whom. I need a system that helps me keep track of all the signals across a deal that might last a year."\n\nCurrently using HubSpot with custom properties but Rachel admits it''s "a mess — reps fill in maybe 40% of the fields."\n\nBudget: Rachel said she needs to get Simon Bell (VP Sales) on board. She thinks £40-50k is realistic but hasn''t formally scoped it.\n\nNext steps: Rachel to bring Simon to the next call so he can see the platform and understand the value.',
  'New opportunity with Pinnacle Health (£42k). RevOps Lead Rachel Green exploring deal intelligence for NHS procurement cycles (6-12 months). Clear pain around stakeholder tracking and signal management across long deal cycles. Currently on HubSpot with poor adoption. Next: get VP Sales Simon Bell on a demo call.',
  28,
  '{"champion":"Rachel Green (RevOps Lead)","championConfirmed":false,"budgetStatus":"unconfirmed","budgetAmount":"£40-50k estimated","timeline":"Exploring — no formal timeline","decisionMaker":"Simon Bell (VP Sales)","nextMeeting":"2026-03-27","buyingSignals":["Inbound from Google search","Clear pain articulated","HubSpot limitations acknowledged"]}'::jsonb,
  '[{"text":"Prepare NHS-focused demo showing long-cycle deal tracking","completed":false,"createdAt":"2026-03-20T00:00:00Z"},{"text":"Research NHS procurement cycles to speak knowledgeably on the call","completed":false,"createdAt":"2026-03-20T00:00:00Z"}]'::jsonb,
  '[{"title":"Demo with Rachel + Simon Bell","date":"2026-03-27T10:00:00Z","type":"demo","attendees":["Rachel Green","Simon Bell","Rees"],"notes":"Need to show long-cycle deal tracking and stakeholder management"}]'::jsonb,
  '2026-06-30T00:00:00Z',
  2,
  '2026-03-20T00:00:00Z',
  '2026-03-23T00:00:00Z'
);

-- Deal 11: Atlas Shipping — Discovery — £66k
INSERT INTO deal_logs (
  workspace_id, user_id, deal_name, prospect_company, prospect_name, prospect_title,
  contacts, description, deal_value, stage, deal_type, recurring_interval,
  competitors, meeting_notes, ai_summary, conversion_score, intent_signals,
  todos, scheduled_events, close_date,
  kanban_order, created_at, updated_at
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'user_3BLvFCWBVW66GwwmThixbRAyXyj',
  'Atlas Shipping — Platform License',
  'Atlas Shipping',
  'Marcus Webb',
  'Commercial Director',
  '[{"name":"Marcus Webb","role":"Commercial Director","email":"m.webb@atlasshipping.com"},{"name":"Claire Dawson","role":"Head of Sales","email":"c.dawson@atlasshipping.com"}]'::jsonb,
  'Atlas Shipping is a global freight and logistics company. Marcus Webb was referred by Emma Watson at CloudScale UK (existing customer). They have a 35-person commercial team managing complex multi-stakeholder shipping contracts.',
  66000,
  'discovery',
  'recurring',
  'annual',
  '[]'::jsonb,
  E'## Intro Call — 21 Mar 2026\nAttendees: Marcus Webb (Commercial Director), Rees (Halvex)\n\nMarcus opened with: "Emma Watson at CloudScale told me I have to talk to you. She said your platform completely changed how she runs pipeline reviews." Strong referral signal.\n\nAtlas Shipping has 35 commercial reps managing freight contracts across Europe. Deals range from £50k to £2M and involve multiple stakeholders (procurement, logistics ops, finance, legal). Marcus said: "I need to know what''s happening in every deal without calling every rep every week."\n\nHe''s particularly interested in the signal extraction from emails because his reps communicate heavily via email with port authorities, shipping lines, and corporate procurement teams.\n\nBudget: Marcus said "if Emma''s getting value at her price point, I''m sure we can work something out." Didn''t give a specific number. Timeline: flexible but wants to evaluate in April.\n\nNext steps: Book a demo with Marcus and Claire Dawson (Head of Sales) next week.',
  'Referral opportunity from CloudScale UK (existing customer). Atlas Shipping Commercial Director Marcus Webb has 35 reps managing complex freight contracts. Strong referral signal, email-heavy workflow is good fit. Next: demo with Marcus and Head of Sales Claire Dawson.',
  38,
  '{"champion":"Marcus Webb (Commercial Director)","championConfirmed":false,"budgetStatus":"unconfirmed","budgetAmount":"Not specified — referral pricing expected","timeline":"Evaluate in April","decisionMaker":"Marcus Webb (likely sole authority)","nextMeeting":"2026-03-28","buyingSignals":["Strong customer referral from CloudScale","Email-heavy workflow = good fit","35 reps = significant pipeline complexity","Unprompted enthusiasm from referral"]}'::jsonb,
  '[{"text":"Send Marcus a short case study from CloudScale (with Emma''s permission)","completed":false,"createdAt":"2026-03-21T00:00:00Z"},{"text":"Book demo with Marcus and Claire Dawson for next week","completed":false,"createdAt":"2026-03-21T00:00:00Z"},{"text":"Ask Emma Watson if she''d do a 5-min reference call with Marcus","completed":false,"createdAt":"2026-03-21T00:00:00Z"}]'::jsonb,
  '[{"title":"Demo with Marcus + Claire","date":"2026-03-28T11:00:00Z","type":"demo","attendees":["Marcus Webb","Claire Dawson","Rees"],"notes":"Referral from CloudScale — show email signal extraction"}]'::jsonb,
  '2026-05-31T00:00:00Z',
  3,
  '2026-03-21T00:00:00Z',
  '2026-03-23T00:00:00Z'
);


-- ============================================================================
-- ACTIVE DEALS — Proposal (4)
-- ============================================================================

-- Deal 12: Vanguard Finance — Proposal — £108k
INSERT INTO deal_logs (
  workspace_id, user_id, deal_name, prospect_company, prospect_name, prospect_title,
  contacts, description, deal_value, stage, deal_type, recurring_interval,
  competitors, meeting_notes, ai_summary, conversion_score, intent_signals,
  todos, scheduled_events, close_date,
  kanban_order, created_at, updated_at
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'user_3BLvFCWBVW66GwwmThixbRAyXyj',
  'Vanguard Finance — Enterprise Deal Intelligence',
  'Vanguard Finance',
  'Alex Turner',
  'CRO',
  '[{"name":"Alex Turner","role":"CRO","email":"a.turner@vanguardfinance.co.uk"},{"name":"Helen Cross","role":"VP Sales","email":"h.cross@vanguardfinance.co.uk"},{"name":"Ian Fletcher","role":"Head of Procurement","email":"i.fletcher@vanguardfinance.co.uk"}]'::jsonb,
  'Vanguard Finance is a London-based fintech (Series C, 200 employees) with a 50-person sales team. CRO Alex Turner saw our presentation at a CRO roundtable and initiated the conversation. Proposal sent, waiting on procurement feedback.',
  108000,
  'proposal',
  'recurring',
  'annual',
  '["Clari", "People.ai"]'::jsonb,
  E'## CRO Roundtable Follow-Up — 3 Mar 2026\nAttendees: Alex Turner (CRO), Rees (Halvex)\n\nAlex approached me after my presentation at the London CRO Club roundtable on "AI in Revenue Operations." He said: "Everything you showed is what I''ve been trying to get from Clari but can''t. Clari gives me forecasts but I don''t trust them because they''re based on rep-entered data."\n\nVanguard has 50 reps, £40M ARR, growing 60% YoY. Alex is under board pressure to improve forecast accuracy and deal visibility. He''s been evaluating People.ai as well.\n\nBudget: "We spend £200k/yr on revenue tooling. I can carve out £100-120k for the right solution." Timeline: wants a decision by end of April before their Q2 planning.\n\n---\n\n## Deep-Dive Demo — 10 Mar 2026\nAttendees: Alex Turner, Helen Cross (VP Sales), Rees (Halvex)\n\nHelen runs the day-to-day sales operation. She was particularly interested in the email signal extraction: "Our reps are terrible at updating Salesforce. If we can get intelligence from their emails automatically, that changes everything."\n\nAlex kept comparing us to Clari throughout the demo: "Clari tells me the number is wrong but doesn''t tell me which deals to fix. You tell me which deals to fix." Strong positioning.\n\nHelen asked about Salesforce integration — confirmed we support it. She also asked about onboarding timeline — wants to be live within 3 weeks of signing.\n\nBoth asked for a formal proposal including ROI analysis.\n\n---\n\n## Proposal Sent — 17 Mar 2026\nSent formal proposal to Alex: £108k/yr for 50-seat enterprise license including Salesforce integration, custom onboarding, and quarterly business reviews. Included ROI model showing £300k+ in recovered pipeline value based on their current stage conversion rates.\n\nAlex forwarded to Ian Fletcher (Head of Procurement) for commercial review. Said he expects feedback by end of March.',
  'Strong enterprise opportunity with Vanguard Finance (£108k). CRO Alex Turner self-qualified from a CRO roundtable event. Comparing against Clari and People.ai — strong positioning on deal-level intelligence vs forecast-level. Proposal sent and in procurement review. VP Sales Helen Cross is aligned. Decision expected by end of April.',
  55,
  '{"champion":"Alex Turner (CRO)","championConfirmed":true,"budgetStatus":"confirmed","budgetAmount":"£100-120k from existing revenue tooling budget","timeline":"Decision by end of April, Q2 planning deadline","decisionMaker":"Alex Turner (CRO) + Ian Fletcher (Procurement)","nextMeeting":"2026-03-31","buyingSignals":["Self-qualified from event","Explicit Clari comparison (favours us)","Budget confirmed","VP Sales aligned","Formal proposal requested"]}'::jsonb,
  '[{"text":"Follow up with Ian Fletcher on procurement review by March 28","completed":false,"createdAt":"2026-03-17T00:00:00Z"},{"text":"Prepare Clari vs Halvex comparison one-pager for Alex","completed":false,"createdAt":"2026-03-10T00:00:00Z"},{"text":"Check in with Alex on proposal feedback","completed":false,"createdAt":"2026-03-23T00:00:00Z"}]'::jsonb,
  '[{"title":"Procurement Review Follow-Up","date":"2026-03-31T15:00:00Z","type":"meeting","attendees":["Alex Turner","Ian Fletcher","Rees"],"notes":"Review commercial terms with procurement"}]'::jsonb,
  '2026-04-30T00:00:00Z',
  1,
  '2026-03-03T00:00:00Z',
  '2026-03-23T00:00:00Z'
);

-- Deal 13: Sterling Consulting — Proposal — £78k
INSERT INTO deal_logs (
  workspace_id, user_id, deal_name, prospect_company, prospect_name, prospect_title,
  contacts, description, deal_value, stage, deal_type, recurring_interval,
  competitors, meeting_notes, ai_summary, conversion_score, intent_signals,
  todos, scheduled_events, close_date,
  kanban_order, created_at, updated_at
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'user_3BLvFCWBVW66GwwmThixbRAyXyj',
  'Sterling Consulting — Platform License',
  'Sterling Consulting',
  'Katie Morris',
  'Managing Partner',
  '[{"name":"Katie Morris","role":"Managing Partner","email":"k.morris@sterlingconsulting.co.uk"},{"name":"Tom Reid","role":"Business Development Director","email":"t.reid@sterlingconsulting.co.uk"}]'::jsonb,
  'Sterling Consulting is a management consulting firm (80 employees) with a 20-person BD team. They are comparing Halvex with Clari. Katie Morris is the decision maker and wants to see clear differentiation before committing.',
  78000,
  'proposal',
  'recurring',
  'annual',
  '["Clari"]'::jsonb,
  E'## Discovery Call — 5 Mar 2026\nAttendees: Katie Morris (Managing Partner), Tom Reid (BD Director), Rees (Halvex)\n\nSterling runs a consultative BD process — their "sales" team is really a 20-person business development team that builds relationships over months before closing engagements worth £200k-£1M. Katie wants better visibility into which relationships are actually progressing toward signed engagements.\n\nTom mentioned they are also evaluating Clari: "We''ve had two demos with them and they''re impressive on the forecasting side. But we need more than forecasts — we need to understand the health of each relationship."\n\nKatie asked pointed questions about our ML methodology and how it handles relationship-based selling vs transactional sales. Good question — we showed how our signal extraction captures relationship signals (meeting frequency, stakeholder expansion, sentiment shifts).\n\nBudget: Katie said "£60-80k for the right tool." Timeline: decision in April.\n\n---\n\n## Proposal Sent — 14 Mar 2026\nSent proposal for £78k/yr. Included a section specifically comparing our approach to Clari for relationship-intensive BD cycles.\n\nKatie responded: "Thanks. We''re meeting with Clari again next week and will make a decision by mid-April. Can you send me some customer references in professional services?"',
  'Proposal-stage opportunity with Sterling Consulting (£78k). Comparing directly with Clari — key differentiator is deal-level relationship intelligence vs forecast accuracy. Katie Morris (Managing Partner) is the sole decision maker. References requested for professional services vertical. Decision expected mid-April.',
  48,
  '{"champion":"Katie Morris (Managing Partner)","championConfirmed":false,"budgetStatus":"confirmed","budgetAmount":"£60-80k","timeline":"Decision mid-April","decisionMaker":"Katie Morris (sole decision maker)","nextMeeting":"2026-04-02","buyingSignals":["Active evaluation underway","Budget confirmed","Decision timeline given","References requested (buying signal)"]}'::jsonb,
  '[{"text":"Find 2 professional services references for Katie (Meridian Capital?)","completed":false,"createdAt":"2026-03-14T00:00:00Z"},{"text":"Send competitive comparison doc: Halvex vs Clari for consulting firms","completed":false,"createdAt":"2026-03-14T00:00:00Z"},{"text":"Schedule follow-up call after Clari meeting","completed":false,"createdAt":"2026-03-14T00:00:00Z"}]'::jsonb,
  '[{"title":"Post-Clari Meeting Follow-Up","date":"2026-04-02T14:00:00Z","type":"meeting","attendees":["Katie Morris","Rees"],"notes":"Debrief after Clari meeting, address any gaps"}]'::jsonb,
  '2026-04-15T00:00:00Z',
  2,
  '2026-03-05T00:00:00Z',
  '2026-03-23T00:00:00Z'
);

-- Deal 14: Nexus Telecom — Proposal — £132k
INSERT INTO deal_logs (
  workspace_id, user_id, deal_name, prospect_company, prospect_name, prospect_title,
  contacts, description, deal_value, stage, deal_type, recurring_interval,
  competitors, meeting_notes, ai_summary, conversion_score, intent_signals,
  todos, scheduled_events, close_date,
  kanban_order, created_at, updated_at
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'user_3BLvFCWBVW66GwwmThixbRAyXyj',
  'Nexus Telecom — Enterprise Deal Intelligence + API',
  'Nexus Telecom',
  'Robert Kim',
  'SVP Sales',
  '[{"name":"Robert Kim","role":"SVP Sales","email":"r.kim@nexustelecom.com"},{"name":"Patricia Hall","role":"VP Sales Operations","email":"p.hall@nexustelecom.com"},{"name":"Steven Burke","role":"Chief Procurement Officer","email":"s.burke@nexustelecom.com"},{"name":"David Chen","role":"IT Security Director","email":"d.chen@nexustelecom.com"}]'::jsonb,
  'Nexus Telecom is a large telecoms company (£500M revenue, 2000 employees) with an 80-person enterprise sales team. This is our largest active opportunity. Full procurement process with security review, multiple stakeholders, and extended evaluation timeline.',
  132000,
  'proposal',
  'recurring',
  'annual',
  '["Gong", "Clari", "People.ai"]'::jsonb,
  E'## Initial Meeting — 24 Feb 2026\nAttendees: Robert Kim (SVP Sales), Patricia Hall (VP Sales Ops), Rees (Halvex)\n\nRobert leads an 80-person enterprise sales team. Their average deal is £500k-£5M with 6-18 month cycles. He needs better deal intelligence across a massive pipeline (200+ active opportunities).\n\nPatricia manages the tech stack and is evaluating 4 vendors: Gong, Clari, People.ai, and Halvex. She runs a formal evaluation process with weighted scoring criteria. This will go through full procurement.\n\nRobert''s primary concern: "I need to know which of my 200 deals are actually going to close this quarter and which are pipe dreams. Right now I rely on gut feel and Monday forecast calls."\n\nBudget: £150k+ approved for "revenue intelligence." Formal RFP expected. Timeline: vendor selection by May, deployment by Q3.\n\n---\n\n## Technical Evaluation — 7 Mar 2026\nAttendees: Patricia Hall, David Chen (IT Security Director), Rees + our CTO\n\nDeep technical session. David reviewed our architecture, data handling, encryption, and compliance posture. He was thorough — 45 minutes on security alone. Gave a preliminary green light pending formal security questionnaire.\n\nPatricia walked through their evaluation scorecard: we scored highest on "deal-level intelligence" and "text-based signal extraction" but she noted Gong scored higher on "call analysis" and Clari on "forecast modelling."\n\nShe said: "You''re the most differentiated vendor in this evaluation. The question is whether your differentiation maps to Robert''s top priority." Good sign.\n\n---\n\n## Proposal Submitted — 18 Mar 2026\nSubmitted formal proposal: £132k/yr for 80-seat enterprise license with API access, Salesforce integration, dedicated CSM, and quarterly business reviews.\n\nSteven Burke (CPO) acknowledged receipt and said procurement review will take 2-3 weeks. Patricia mentioned the next step is a finalist presentation to Robert''s leadership team.',
  'Large enterprise opportunity with Nexus Telecom (£132k). 80-person sales team, 4-vendor evaluation against Gong, Clari, and People.ai. Scored highest on deal-level intelligence in formal evaluation. Security review in progress. Procurement-led process — CPO Steven Burke managing commercial terms. Finalist presentation pending.',
  52,
  '{"champion":"Patricia Hall (VP Sales Ops)","championConfirmed":true,"budgetStatus":"approved","budgetAmount":"£150k+ for revenue intelligence","timeline":"Vendor selection by May, deployment Q3","decisionMaker":"Robert Kim (SVP Sales) — final decision; Steven Burke (CPO) — commercial","nextMeeting":"2026-04-07","buyingSignals":["Formal RFP process (serious buyer)","Top score on deal intelligence category","Security preliminary green light","Large budget approved","4-vendor shortlist (competitive but engaged)"]}'::jsonb,
  '[{"text":"Complete Nexus Telecom security questionnaire (due March 28)","completed":false,"createdAt":"2026-03-18T00:00:00Z"},{"text":"Prepare finalist presentation deck for leadership team","completed":false,"createdAt":"2026-03-18T00:00:00Z"},{"text":"Get ROI case study from Meridian Capital for financial services reference","completed":false,"createdAt":"2026-03-18T00:00:00Z"},{"text":"Follow up with Patricia on evaluation timeline","completed":false,"createdAt":"2026-03-23T00:00:00Z"}]'::jsonb,
  '[{"title":"Finalist Presentation to Leadership","date":"2026-04-07T10:00:00Z","type":"presentation","attendees":["Robert Kim","Patricia Hall","Steven Burke","Rees"],"notes":"Finalist presentation — focus on deal intelligence differentiation and ROI"}]'::jsonb,
  '2026-05-15T00:00:00Z',
  3,
  '2026-02-24T00:00:00Z',
  '2026-03-23T00:00:00Z'
);

-- Deal 15: Oakwood Properties — Proposal — £48k
INSERT INTO deal_logs (
  workspace_id, user_id, deal_name, prospect_company, prospect_name, prospect_title,
  contacts, description, deal_value, stage, deal_type, recurring_interval,
  competitors, meeting_notes, ai_summary, conversion_score, intent_signals,
  todos, scheduled_events, close_date,
  kanban_order, created_at, updated_at
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'user_3BLvFCWBVW66GwwmThixbRAyXyj',
  'Oakwood Properties — Growth Plan',
  'Oakwood Properties',
  'Hannah Baker',
  'Sales Manager',
  '[{"name":"Hannah Baker","role":"Sales Manager","email":"h.baker@oakwoodproperties.co.uk"},{"name":"James Oakley","role":"Managing Director","email":"j.oakley@oakwoodproperties.co.uk"}]'::jsonb,
  'Oakwood Properties is a commercial real estate company with a small 10-person sales team. Hannah Baker manages the team and wants better deal visibility. Price sensitive — small company with limited tech budget.',
  48000,
  'proposal',
  'recurring',
  'annual',
  '["HubSpot native reporting"]'::jsonb,
  E'## Discovery Call — 11 Mar 2026\nAttendees: Hannah Baker (Sales Manager), Rees (Halvex)\n\nHannah runs a 10-person team selling commercial properties (offices, warehouses, retail spaces). Average deal is £1-5M with 3-6 month cycles. She currently tracks everything in spreadsheets + HubSpot.\n\nHer pain: "I spend every Friday afternoon pulling together a pipeline report for James (MD). I know there must be a better way." She saw our LinkedIn ad and was curious.\n\nConcern: "We''re a small company. I need to make sure the cost is justified for a 10-person team." Very price conscious.\n\nBudget: Hannah said she needs James to approve anything over £20k. She thinks £40-50k is "a stretch but possible if the ROI is clear."\n\n---\n\n## Demo — 18 Mar 2026\nAttendees: Hannah Baker, James Oakley (MD)\n\nJames was initially sceptical about the price but became interested when he saw the auto-generated pipeline summary. "If this means Hannah doesn''t spend every Friday on reports, and I get better information, it could work."\n\nHannah asked about a smaller package or month-to-month option. We discussed our Growth Plan at £48k/yr but noted we don''t currently offer monthly billing for that tier.\n\nJames said: "Send us the proposal. I want to see the numbers and think about it over the weekend."',
  'Small opportunity with Oakwood Properties (£48k). Sales Manager Hannah Baker is the champion, MD James Oakley is the decision maker. Price sensitive — small team, limited tech budget. Demo went well but pricing is a stretch. Proposal sent, waiting on MD decision.',
  42,
  '{"champion":"Hannah Baker (Sales Manager)","championConfirmed":true,"budgetStatus":"stretch","budgetAmount":"£40-50k stretch budget","timeline":"Thinking it over — no firm timeline","decisionMaker":"James Oakley (MD)","nextMeeting":"2026-03-28","buyingSignals":["Proposal requested by MD","Pipeline reporting pain is real","Demo resonated with decision maker"]}'::jsonb,
  '[{"text":"Prepare ROI analysis specific to 10-person team to justify pricing","completed":false,"createdAt":"2026-03-18T00:00:00Z"},{"text":"Check with team if we can offer quarterly billing to reduce upfront commitment","completed":false,"createdAt":"2026-03-18T00:00:00Z"}]'::jsonb,
  '[{"title":"Follow-Up with Hannah + James","date":"2026-03-28T16:00:00Z","type":"meeting","attendees":["Hannah Baker","James Oakley","Rees"],"notes":"Pricing discussion — come prepared with ROI analysis and flexible billing options"}]'::jsonb,
  '2026-04-30T00:00:00Z',
  4,
  '2026-03-11T00:00:00Z',
  '2026-03-23T00:00:00Z'
);


-- ============================================================================
-- ACTIVE DEALS — Trial Phase (qualification stage with custom label) (4)
-- ============================================================================

-- Deal 16: Zenith Aerospace — Trial — £144k
INSERT INTO deal_logs (
  workspace_id, user_id, deal_name, prospect_company, prospect_name, prospect_title,
  contacts, description, deal_value, stage, deal_type, recurring_interval,
  competitors, meeting_notes, ai_summary, conversion_score, intent_signals,
  todos, scheduled_events, close_date, engagement_type,
  kanban_order, created_at, updated_at
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'user_3BLvFCWBVW66GwwmThixbRAyXyj',
  'Zenith Aerospace — Enterprise POC',
  'Zenith Aerospace',
  'Colonel James Wright',
  'Programme Director',
  '[{"name":"James Wright","role":"Programme Director","email":"j.wright@zenith-aero.com"},{"name":"Laura Bennett","role":"Commercial Manager","email":"l.bennett@zenith-aero.com"},{"name":"Dr. Sarah Phillips","role":"Head of Digital Transformation","email":"s.phillips@zenith-aero.com"}]'::jsonb,
  'Zenith Aerospace is a defence and aerospace company running a 30-day POC with 5 commercial reps. High-value enterprise opportunity with complex procurement. Colonel Wright is a former military procurement officer who now leads commercial programmes — very process-driven evaluation.',
  144000,
  'qualification',
  'recurring',
  'annual',
  '["People.ai"]'::jsonb,
  E'## POC Kickoff — 3 Mar 2026\nAttendees: Col. James Wright (Programme Director), Laura Bennett (Commercial Manager), Dr. Sarah Phillips (Head of Digital Transformation), Rees (Halvex)\n\nZenith Aerospace has a 60-person commercial team selling defence and aerospace solutions to governments and prime contractors. Their deals range from £5M to £50M with 12-24 month cycles.\n\nCol. Wright runs the evaluation like a military programme: structured criteria, weekly QA checkpoints, and a formal pass/fail assessment at the end. He said: "I don''t care about flashy demos. Show me results over 30 days with my real data and my real team."\n\nPOC scope: 5 commercial reps forwarding deal emails and notes for 30 days. Success criteria:\n1. Signal extraction accuracy > 85%\n2. Conversion scores correlate with actual deal outcomes\n3. Time saved per rep > 3 hours/week\n4. Security audit passed (critical — defence sector)\n\nDr. Phillips is leading the digital transformation initiative that this sits under. She has budget authority and is supportive.\n\n---\n\n## Week 1 QA — 10 Mar 2026\nAttendees: Laura Bennett, Rees (Halvex)\n\nLaura shared initial feedback: 4 of 5 reps are actively forwarding emails. Signal extraction accuracy is at 88% (above threshold). One rep (Mike) is struggling with the email forwarding setup — scheduled a quick training session.\n\nLaura said: "The conversion scores are interesting. One deal that James has been worried about scored 23 out of 100 and James said that matches his instinct exactly."\n\n---\n\n## Week 2 QA — 17 Mar 2026\nAttendees: Col. James Wright, Laura Bennett, Dr. Sarah Phillips, Rees (Halvex)\n\nMid-point review. Col. Wright reviewed the metrics:\n- Signal accuracy: 91% (exceeds 85% threshold)\n- Rep time savings: averaging 4.2 hrs/week (exceeds 3hr threshold)\n- Score correlation: "promising but need more data points"\n\nCol. Wright: "You''re tracking well. If the second half continues like this, I''ll recommend proceeding to procurement." Dr. Phillips nodded and said "budget is available in the Q2 digital transformation allocation."\n\nSecurity audit is 75% complete — no red flags so far. Final assessment due March 28.',
  'High-value POC with Zenith Aerospace (£144k). Defence and aerospace company running a structured 30-day evaluation with 5 reps. Week 2 results exceed all thresholds — signal accuracy 91%, rep time savings 4.2 hrs/week. Col. Wright tracking toward procurement recommendation. Security audit 75% complete. Final assessment March 28.',
  72,
  '{"champion":"Dr. Sarah Phillips (Head of Digital Transformation)","championConfirmed":true,"budgetStatus":"available","budgetAmount":"Q2 digital transformation allocation — amount TBD","timeline":"POC ends March 28, procurement April-May","decisionMaker":"Col. James Wright (Programme Director) — recommender; Dr. Sarah Phillips — budget authority","nextMeeting":"2026-03-28","buyingSignals":["Exceeding all POC success criteria","Budget confirmed by Dr. Phillips","Col. Wright trending toward recommendation","5 reps actively engaged","Security audit progressing clean"]}'::jsonb,
  '[{"text":"Prepare Week 3 QA metrics report","completed":false,"createdAt":"2026-03-17T00:00:00Z"},{"text":"Follow up on security audit completion (due March 28)","completed":false,"createdAt":"2026-03-17T00:00:00Z"},{"text":"Schedule final POC assessment with Col. Wright for March 28","completed":false,"createdAt":"2026-03-17T00:00:00Z"},{"text":"Prepare pricing proposal for post-POC procurement phase","completed":false,"createdAt":"2026-03-17T00:00:00Z"}]'::jsonb,
  '[{"title":"Week 3 QA Review","date":"2026-03-24T14:00:00Z","type":"meeting","attendees":["Laura Bennett","Rees"],"notes":"Week 3 metrics review"},{"title":"Final POC Assessment","date":"2026-03-28T10:00:00Z","type":"review","attendees":["Col. James Wright","Laura Bennett","Dr. Sarah Phillips","Rees"],"notes":"Pass/fail assessment — bring all metrics and ROI analysis"}]'::jsonb,
  '2026-05-31T00:00:00Z',
  'POC',
  1,
  '2026-03-03T00:00:00Z',
  '2026-03-23T00:00:00Z'
);

-- Deal 17: Harbour Logistics — Trial — £72k
INSERT INTO deal_logs (
  workspace_id, user_id, deal_name, prospect_company, prospect_name, prospect_title,
  contacts, description, deal_value, stage, deal_type, recurring_interval,
  competitors, meeting_notes, ai_summary, conversion_score, intent_signals,
  todos, scheduled_events, close_date, engagement_type,
  kanban_order, created_at, updated_at
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'user_3BLvFCWBVW66GwwmThixbRAyXyj',
  'Harbour Logistics — Pilot Programme',
  'Harbour Logistics',
  'Sophie Bennett',
  'Head of Commercial',
  '[{"name":"Sophie Bennett","role":"Head of Commercial","email":"s.bennett@harbourlogistics.co.uk"},{"name":"Liam O''Brien","role":"Sales Team Lead","email":"l.obrien@harbourlogistics.co.uk"}]'::jsonb,
  'Harbour Logistics is a UK-based supply chain company with 25 commercial reps. Sophie Bennett is running a 2-week pilot with 3 reps before deciding on a full rollout.',
  72000,
  'qualification',
  'recurring',
  'annual',
  '[]'::jsonb,
  E'## Pilot Kickoff — 10 Mar 2026\nAttendees: Sophie Bennett (Head of Commercial), Liam O''Brien (Sales Team Lead), Rees (Halvex)\n\nSophie wants to test Halvex with 3 of her strongest reps before committing to a full rollout. "If my best people love it, the rest of the team will follow." Smart approach.\n\nLiam is the team lead who will coordinate the pilot reps. He''s very hands-on and immediately started forwarding emails during the kickoff call. "I''ve got 15 active deals — let me feed them all in and see what happens."\n\nPilot success criteria (informal): reps find it useful and want to keep using it. Sophie said "I don''t need a spreadsheet of metrics. If Liam and his two reps tell me they want it, that''s enough."\n\n---\n\n## Pilot Check-In — 19 Mar 2026\nAttendees: Sophie Bennett, Liam O''Brien, Rees (Halvex)\n\nLiam is very positive: "I''m forwarding every client email now. The signal extraction caught a budget concern in a deal I thought was solid — I followed up immediately and the client confirmed they were reconsidering. Without this, I would have lost that deal."\n\nThe other two pilot reps are also actively using the platform. Sophie said: "Liam is sold. Let me talk to finance about the full rollout pricing. Can you extend the trial by one more week while I sort the budget?"',
  'Pilot with Harbour Logistics (£72k) going well. 3 reps in 2-week trial, all actively engaged. Team Lead Liam O''Brien is already an advocate — signal extraction caught a budget concern he would have missed. Sophie Bennett extending trial by one week while sorting budget for full rollout. Strong buying signal.',
  65,
  '{"champion":"Sophie Bennett (Head of Commercial)","championConfirmed":true,"budgetStatus":"in progress","budgetAmount":"Full rollout pricing TBD","timeline":"Budget approval within 2 weeks","decisionMaker":"Sophie Bennett","nextMeeting":"2026-03-26","buyingSignals":["All 3 pilot reps actively engaged","Team lead is an advocate","Trial extension = wanting more (good sign)","Initiated budget conversation unprompted"]}'::jsonb,
  '[{"text":"Extend Harbour Logistics trial by one week","completed":true,"createdAt":"2026-03-19T00:00:00Z"},{"text":"Send full rollout pricing proposal to Sophie","completed":false,"createdAt":"2026-03-19T00:00:00Z"},{"text":"Get testimonial quote from Liam for future reference use","completed":false,"createdAt":"2026-03-19T00:00:00Z"}]'::jsonb,
  '[{"title":"Rollout Pricing Discussion","date":"2026-03-26T11:00:00Z","type":"meeting","attendees":["Sophie Bennett","Rees"],"notes":"Review full rollout pricing and deployment timeline"}]'::jsonb,
  '2026-04-30T00:00:00Z',
  'Pilot',
  2,
  '2026-03-10T00:00:00Z',
  '2026-03-23T00:00:00Z'
);

-- Deal 18: Crestline Partners — Trial — £96k
INSERT INTO deal_logs (
  workspace_id, user_id, deal_name, prospect_company, prospect_name, prospect_title,
  contacts, description, deal_value, stage, deal_type, recurring_interval,
  competitors, meeting_notes, ai_summary, conversion_score, intent_signals,
  todos, scheduled_events, close_date, engagement_type,
  kanban_order, created_at, updated_at
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'user_3BLvFCWBVW66GwwmThixbRAyXyj',
  'Crestline Partners — Enterprise Trial',
  'Crestline Partners',
  'Thomas Grey',
  'Partner',
  '[{"name":"Thomas Grey","role":"Partner","email":"t.grey@crestlinepartners.com"},{"name":"Amelia Foster","role":"Director of BD","email":"a.foster@crestlinepartners.com"},{"name":"Charles Hunt","role":"COO","email":"c.hunt@crestlinepartners.com"}]'::jsonb,
  'Crestline Partners is a private equity firm with a 15-person BD team. Thomas Grey (Partner) is evaluating ROI after a 2-week trial. Analytically driven — wants hard numbers before committing.',
  96000,
  'qualification',
  'recurring',
  'annual',
  '["Clari"]'::jsonb,
  E'## Trial Kickoff — 7 Mar 2026\nAttendees: Thomas Grey (Partner), Amelia Foster (Director of BD), Rees (Halvex)\n\nCrestline Partners runs a lean BD operation focused on deal sourcing and relationship management in PE. Thomas is analytically rigorous — he wants to measure everything.\n\nTrial setup: full BD team (15 people) using the platform for 2 weeks. Thomas defined his own ROI framework: "I want to measure time saved, deals surfaced that we would have missed, and signal accuracy. If the numbers work, we buy. If they don''t, we pass. No emotions."\n\nAmelia is more enthusiastic: "I already love the interface. But Thomas is right — we need to see the numbers."\n\nThey also have Clari on a parallel trial — Thomas is running a head-to-head evaluation.\n\n---\n\n## Week 1 Check-In — 14 Mar 2026\nAttendees: Thomas Grey, Amelia Foster, Rees (Halvex)\n\nThomas shared his week 1 analysis:\n- Time saved: 2.8 hrs/person/week (he calculated this precisely)\n- Signals surfaced: 12 buying signals across 8 deals that were not in their CRM\n- Accuracy: "I spot-checked 20 signals and 17 were genuinely useful. 85% is acceptable."\n\nHe said: "The data is promising but I need another week. I also want to compare these numbers against Clari''s trial metrics."\n\nAmelia privately told me after the call: "Thomas is impressed. He wouldn''t be doing this level of analysis if he wasn''t. Clari''s trial isn''t going as well — their reps find it harder to use."',
  'Analytical trial evaluation with Crestline Partners (£96k). Partner Thomas Grey running head-to-head trial against Clari with his own ROI framework. Week 1 metrics positive — 2.8 hrs saved/person, 85% signal accuracy, 12 buying signals surfaced. Director of BD Amelia Foster indicates privately that Clari trial is struggling. Week 2 data due March 28.',
  68,
  '{"champion":"Amelia Foster (Director of BD)","championConfirmed":true,"budgetStatus":"conditional","budgetAmount":"£96k if ROI proven","timeline":"Decision after 2-week trial ends March 21","decisionMaker":"Thomas Grey (Partner) — numbers-driven","nextMeeting":"2026-03-25","buyingSignals":["Deep analytical engagement (positive sign)","Week 1 metrics exceed thresholds","Clari trial struggling (per Amelia)","Full BD team engaged","Thomas doing detailed ROI analysis"]}'::jsonb,
  '[{"text":"Prepare comprehensive Week 2 metrics report for Thomas","completed":false,"createdAt":"2026-03-14T00:00:00Z"},{"text":"Get case study with quantified ROI from Meridian Capital","completed":false,"createdAt":"2026-03-14T00:00:00Z"},{"text":"Follow up with Amelia on Clari comparison privately","completed":false,"createdAt":"2026-03-14T00:00:00Z"}]'::jsonb,
  '[{"title":"Trial Conclusion Review","date":"2026-03-25T15:00:00Z","type":"review","attendees":["Thomas Grey","Amelia Foster","Rees"],"notes":"Final trial metrics and ROI analysis — bring Clari comparison data"}]'::jsonb,
  '2026-04-15T00:00:00Z',
  'Pilot',
  3,
  '2026-03-07T00:00:00Z',
  '2026-03-23T00:00:00Z'
);

-- Deal 19: Evergreen Energy — Trial — £60k
INSERT INTO deal_logs (
  workspace_id, user_id, deal_name, prospect_company, prospect_name, prospect_title,
  contacts, description, deal_value, stage, deal_type, recurring_interval,
  competitors, meeting_notes, ai_summary, conversion_score, intent_signals,
  todos, scheduled_events, close_date, engagement_type,
  kanban_order, created_at, updated_at
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'user_3BLvFCWBVW66GwwmThixbRAyXyj',
  'Evergreen Energy — Platform Trial',
  'Evergreen Energy',
  'Priya Sharma',
  'Sales Enablement Manager',
  '[{"name":"Priya Sharma","role":"Sales Enablement Manager","email":"p.sharma@evergreenenergy.co.uk"},{"name":"Matt Cooper","role":"VP Sales","email":"m.cooper@evergreenenergy.co.uk"}]'::jsonb,
  'Evergreen Energy is a renewable energy company with a 20-person sales team. Priya Sharma is running a trial and has requested an extension to gather more data before presenting to her VP Sales.',
  60000,
  'qualification',
  'recurring',
  'annual',
  '["HubSpot native reporting"]'::jsonb,
  E'## Trial Kickoff — 12 Mar 2026\nAttendees: Priya Sharma (Sales Enablement Manager), Rees (Halvex)\n\nPriya manages sales enablement for a 20-person team selling solar and wind energy installations to commercial clients. Deals range from £100k to £2M. She''s looking for a tool that helps reps understand their deal health without relying on HubSpot reports.\n\nCurrently using HubSpot with custom dashboards but reps find them "clunky and unreliable." Priya wants something reps will actually use.\n\nTrial: 10 reps for 2 weeks. Priya wants to build an internal business case for Matt Cooper (VP Sales) before involving him.\n\n---\n\n## Week 1 Check-In — 19 Mar 2026\nAttendees: Priya Sharma, Rees (Halvex)\n\nMixed results. 7 of 10 reps are actively using the platform (good adoption). But Priya wants more data: "The reps who are using it love it, but I need to show Matt that the 3 holdouts would also benefit. Can we extend the trial by 2 weeks?"\n\nI agreed to the extension. Priya said she''d schedule a session with the 3 non-adopting reps to help them get started.\n\nPositive signals: one rep told Priya the platform "caught a competitor mention in an email thread that he totally missed." Priya is building a slide deck of these wins for Matt.',
  'Extended trial with Evergreen Energy (£60k). 7/10 reps actively using platform after week 1 — high adoption rate. Trial extended by 2 weeks to build internal business case for VP Sales Matt Cooper. Sales Enablement Manager Priya Sharma building a wins deck from rep feedback. Next: present business case to Matt Cooper by early April.',
  58,
  '{"champion":"Priya Sharma (Sales Enablement Manager)","championConfirmed":true,"budgetStatus":"unconfirmed","budgetAmount":"TBD — Priya building business case","timeline":"Extended trial + business case by early April","decisionMaker":"Matt Cooper (VP Sales)","nextMeeting":"2026-04-02","buyingSignals":["70% adoption in week 1 (strong)","Reps who use it love it","Building internal wins deck","Requested trial extension (engaged, not stalling)"]}'::jsonb,
  '[{"text":"Set up training session for 3 non-adopting reps at Evergreen","completed":false,"createdAt":"2026-03-19T00:00:00Z"},{"text":"Help Priya build the business case slide deck","completed":false,"createdAt":"2026-03-19T00:00:00Z"},{"text":"Schedule intro call with Matt Cooper for post-trial review","completed":false,"createdAt":"2026-03-19T00:00:00Z"}]'::jsonb,
  '[{"title":"Non-Adopter Training Session","date":"2026-03-25T15:00:00Z","type":"training","attendees":["3 Evergreen reps","Priya Sharma","Rees"],"notes":"Help 3 holdout reps get started with email forwarding"},{"title":"Business Case Review with VP Sales","date":"2026-04-02T14:00:00Z","type":"meeting","attendees":["Priya Sharma","Matt Cooper","Rees"],"notes":"Present trial results and business case to VP Sales"}]'::jsonb,
  '2026-04-30T00:00:00Z',
  'Pilot',
  4,
  '2026-03-12T00:00:00Z',
  '2026-03-23T00:00:00Z'
);


-- ============================================================================
-- ACTIVE DEALS — Verbal Commit (prospecting stage with custom label) (3)
-- ============================================================================

-- Deal 20: Monarch Insurance — Verbal Commit — £156k
INSERT INTO deal_logs (
  workspace_id, user_id, deal_name, prospect_company, prospect_name, prospect_title,
  contacts, description, deal_value, stage, deal_type, recurring_interval,
  competitors, meeting_notes, ai_summary, conversion_score, intent_signals,
  todos, scheduled_events, close_date,
  kanban_order, created_at, updated_at
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'user_3BLvFCWBVW66GwwmThixbRAyXyj',
  'Monarch Insurance — Enterprise Platform + Premium Support',
  'Monarch Insurance',
  'William Foster',
  'Chief Revenue Officer',
  '[{"name":"William Foster","role":"Chief Revenue Officer","email":"w.foster@monarchinsurance.co.uk"},{"name":"Diana Walsh","role":"General Counsel","email":"d.walsh@monarchinsurance.co.uk"},{"name":"Peter Andrews","role":"VP Sales","email":"p.andrews@monarchinsurance.co.uk"},{"name":"Sarah Collins","role":"Data Protection Officer","email":"s.collins@monarchinsurance.co.uk"}]'::jsonb,
  'Monarch Insurance is a major UK insurance company with a 70-person sales team. William Foster (CRO) has given a verbal yes and the contract is in legal review with General Counsel Diana Walsh. Largest active deal — premium support included. Expected to close within 2 weeks.',
  156000,
  'prospecting',
  'recurring',
  'annual',
  '["People.ai"]'::jsonb,
  E'## Executive Briefing — 10 Feb 2026\nAttendees: William Foster (CRO), Peter Andrews (VP Sales), Rees (Halvex)\n\nWilliam was introduced through a board connection. Monarch Insurance has 70 sales reps selling commercial insurance policies. William''s challenge: "Insurance sales is relationship-driven with 6-12 month cycles. I need to know which of my 300+ active opportunities are real and which are just relationship maintenance."\n\nPeter echoed: "Our reps are great at building relationships but terrible at qualifying opportunities. We need AI to separate the real deals from the noise."\n\nBudget: William confirmed £150-180k approved for a "revenue intelligence initiative" in the 2026 budget. People.ai was also being evaluated but William said "their activity tracking feels too Big Brother for our culture."\n\n---\n\n## Full Demo + Security Review — 24 Feb 2026\nAttendees: William Foster, Peter Andrews, Sarah Collins (DPO), Rees (Halvex)\n\nSarah Collins (Data Protection Officer) joined for the security and compliance review. Insurance is heavily regulated — she spent 30 minutes on GDPR, data residency, and client data handling.\n\nSarah was thorough but fair: "Your data processing agreement is actually one of the better ones I''ve reviewed. I''m comfortable with how you handle personal data."\n\nWilliam saw the conversion scoring in action: "If this can tell me which of my 300 deals are actually going to close, I''ll sign today." Peter was equally enthusiastic about the email signal extraction for their heavily email-driven sales process.\n\n---\n\n## Verbal Commitment — 12 Mar 2026\nAttendees: William Foster, Rees (Halvex)\n\nWilliam called to say: "We''re going with Halvex. I''ve told People.ai they''re out. Diana Walsh (General Counsel) needs to review the contract — expect 2-3 weeks for legal review. This is standard for us, don''t worry about it."\n\nContract sent to Diana Walsh same day. £156k/yr including premium support tier.\n\n---\n\n## Legal Review Update — 20 Mar 2026\nDiana Walsh sent back redlines — mostly standard insurance industry terms (indemnification, data breach notification timelines, professional indemnity insurance). Nothing concerning. We''re reviewing and will send back clean version by March 25.\n\nWilliam confirmed: "Diana''s changes are routine. We''re on track to sign by end of March."',
  'Verbal commitment from Monarch Insurance (£156k) — largest active deal. CRO William Foster has confirmed the decision and rejected People.ai. Contract in legal review with General Counsel Diana Walsh — standard insurance industry redlines, nothing blocking. DPO Sarah Collins cleared security review. Expected to sign by end of March.',
  88,
  '{"champion":"William Foster (CRO)","championConfirmed":true,"budgetStatus":"approved","budgetAmount":"£150-180k approved in 2026 budget","timeline":"Sign by end of March — legal review in progress","decisionMaker":"William Foster (CRO) — decision made; Diana Walsh (GC) — contract execution","nextMeeting":"2026-03-25","buyingSignals":["Verbal yes from CRO","Competitor rejected","Budget pre-approved","DPO cleared security","Standard legal redlines only"]}'::jsonb,
  '[{"text":"Review Diana Walsh legal redlines and send clean version by March 25","completed":false,"createdAt":"2026-03-20T00:00:00Z"},{"text":"Confirm professional indemnity insurance details for legal team","completed":false,"createdAt":"2026-03-20T00:00:00Z"},{"text":"Prepare onboarding plan for 70-person team rollout","completed":false,"createdAt":"2026-03-20T00:00:00Z"}]'::jsonb,
  '[{"title":"Contract Clean Version Review","date":"2026-03-25T10:00:00Z","type":"meeting","attendees":["Diana Walsh","Rees"],"notes":"Review clean contract with legal redlines resolved"},{"title":"Onboarding Planning","date":"2026-04-01T14:00:00Z","type":"meeting","attendees":["Peter Andrews","Rees"],"notes":"Plan 70-person rollout (pending contract signature)"}]'::jsonb,
  '2026-03-31T00:00:00Z',
  1,
  '2026-02-10T00:00:00Z',
  '2026-03-23T00:00:00Z'
);

-- Deal 21: Brightwave Digital — Verbal Commit — £84k
INSERT INTO deal_logs (
  workspace_id, user_id, deal_name, prospect_company, prospect_name, prospect_title,
  contacts, description, deal_value, stage, deal_type, recurring_interval,
  competitors, meeting_notes, ai_summary, conversion_score, intent_signals,
  todos, scheduled_events, close_date,
  kanban_order, created_at, updated_at
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'user_3BLvFCWBVW66GwwmThixbRAyXyj',
  'Brightwave Digital — Annual Platform License',
  'Brightwave Digital',
  'Zara Ahmed',
  'VP Growth',
  '[{"name":"Zara Ahmed","role":"VP Growth","email":"z.ahmed@brightwave.digital"},{"name":"Oliver Grant","role":"Finance Manager","email":"o.grant@brightwave.digital"}]'::jsonb,
  'Brightwave Digital is a performance marketing agency with a 30-person BD team. Zara Ahmed (VP Growth) has given a verbal yes after a successful trial. Paperwork is pending — Zara is coordinating with finance for PO generation.',
  84000,
  'prospecting',
  'recurring',
  'annual',
  '[]'::jsonb,
  E'## Discovery + Demo — 28 Feb 2026\nAttendees: Zara Ahmed (VP Growth), Rees (Halvex)\n\nZara runs a 30-person business development team at a fast-growing performance marketing agency. They manage 150+ active prospects and Zara has no visibility into which prospects are actually likely to convert.\n\n"I''m flying blind. I have gut feel and Slack messages — that''s it." She wants data-driven pipeline management.\n\nDemo went exceptionally well. Zara said "I can already see how this changes my Monday pipeline reviews from guesswork to science."\n\nBudget: £80-90k available. Zara is the decision maker for tools under £100k.\n\n---\n\n## Trial (2 weeks) — 7-21 Mar 2026\nZara ran a 2-week trial with her full BD team. Results were strong: 85% adoption, average 3.5 hrs/week saved per rep, and the conversion scoring correctly identified 2 prospects that subsequently converted.\n\nZara sent a message on March 21: "We''re in. Send me the contract and I''ll get Oliver (Finance) to generate the PO. Give me until end of March."\n\n---\n\n## PO Update — 22 Mar 2026\nQuick email exchange. Oliver Grant (Finance Manager) confirmed the PO is in processing. Expected to have it by March 27. Zara said: "Consider this done — just waiting for the paperwork to catch up."',
  'Verbal commitment from Brightwave Digital (£84k). VP Growth Zara Ahmed confirmed after 2-week trial with 85% adoption. PO in processing with Finance Manager Oliver Grant — expected by March 27. No competitors in the deal. Straightforward close pending paperwork.',
  82,
  '{"champion":"Zara Ahmed (VP Growth)","championConfirmed":true,"budgetStatus":"approved","budgetAmount":"£80-90k available","timeline":"PO by March 27, signature by end of March","decisionMaker":"Zara Ahmed (sole authority under £100k)","nextMeeting":null,"buyingSignals":["Verbal yes confirmed","PO in processing","85% trial adoption","Finance engaged on paperwork","No competitors"]}'::jsonb,
  '[{"text":"Send final contract to Zara for signature","completed":true,"createdAt":"2026-03-21T00:00:00Z"},{"text":"Follow up with Oliver Grant on PO status by March 26","completed":false,"createdAt":"2026-03-22T00:00:00Z"}]'::jsonb,
  '[{"title":"Contract Signature (target)","date":"2026-03-28T00:00:00Z","type":"milestone","attendees":["Zara Ahmed"],"notes":"Target signature date — PO expected March 27"}]'::jsonb,
  '2026-03-31T00:00:00Z',
  2,
  '2026-02-28T00:00:00Z',
  '2026-03-23T00:00:00Z'
);

-- Deal 22: Ironclad Cyber — Verbal Commit — £108k
INSERT INTO deal_logs (
  workspace_id, user_id, deal_name, prospect_company, prospect_name, prospect_title,
  contacts, description, deal_value, stage, deal_type, recurring_interval,
  competitors, meeting_notes, ai_summary, conversion_score, intent_signals,
  todos, scheduled_events, close_date,
  kanban_order, created_at, updated_at
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'user_3BLvFCWBVW66GwwmThixbRAyXyj',
  'Ironclad Cyber — Enterprise Security Intelligence',
  'Ironclad Cyber',
  'Jack Sullivan',
  'CISO / Acting CRO',
  '[{"name":"Jack Sullivan","role":"CISO / Acting CRO","email":"j.sullivan@ironcladcyber.com"},{"name":"Maria Torres","role":"VP Sales","email":"m.torres@ironcladcyber.com"},{"name":"Robert Chambers","role":"Head of Legal","email":"r.chambers@ironcladcyber.com"}]'::jsonb,
  'Ironclad Cyber is a cybersecurity consulting firm with a 25-person sales team. Jack Sullivan wears two hats (CISO and acting CRO) and personally drove the security review. Platform passed their penetration testing and security audit. Verbal yes, contract with legal.',
  108000,
  'prospecting',
  'recurring',
  'annual',
  '["Gong"]'::jsonb,
  E'## Security-First Discovery — 18 Feb 2026\nAttendees: Jack Sullivan (CISO/CRO), Maria Torres (VP Sales), Rees (Halvex)\n\nUnique situation: Jack is both the CISO and acting CRO (previous CRO left 3 months ago). He evaluates every tool from a security perspective first. "If it doesn''t pass my security review, I don''t care how good it is."\n\nMaria handles the day-to-day sales operation (25 reps selling cybersecurity consulting to enterprises). She wants better deal intelligence but knows any tool needs Jack''s security blessing first.\n\nThey looked at Gong but Jack rejected it: "I''m not recording our calls with clients where we discuss their security vulnerabilities. Non-starter." Text-first Halvex is a much better fit.\n\nBudget: £100-120k approved. Jack has both budget authority (CRO hat) and security authority (CISO hat).\n\n---\n\n## Security Deep-Dive — 3 Mar 2026\nAttendees: Jack Sullivan, our CTO\n\nJack ran a thorough security assessment: architecture review, data flow audit, encryption at rest and in transit, SOC2 compliance verification, and a custom penetration test request.\n\nOur CTO spent 2 hours with Jack walking through every aspect. Jack was impressed: "You actually do security properly. Most SaaS vendors give me a SOC2 report and hope I don''t ask questions. You clearly understand threat modelling."\n\nPen test scheduled for the following week.\n\n---\n\n## Pen Test Passed + Verbal Yes — 14 Mar 2026\nJack emailed: "Pen test clean. Security review passed. Maria and I are both in — send the contract to Robert Chambers (Head of Legal). I want this live by mid-April."\n\nContract sent same day. Robert acknowledged receipt and said 2 weeks for legal review.\n\n---\n\n## Legal Update — 21 Mar 2026\nRobert sent back minor redlines focused on data breach notification timelines and liability caps — standard cybersecurity industry terms. We accepted most and pushed back on one clause (unlimited liability). Expecting resolution by March 28.',
  'Verbal commitment from Ironclad Cyber (£108k). CISO/CRO Jack Sullivan personally drove and passed the security review including penetration testing. Gong rejected on security grounds (call recording of security discussions). Contract in legal with minor redlines — data breach notification terms. Expected close by end of March.',
  85,
  '{"champion":"Jack Sullivan (CISO/CRO)","championConfirmed":true,"budgetStatus":"approved","budgetAmount":"£100-120k approved","timeline":"Close by end of March, live by mid-April","decisionMaker":"Jack Sullivan (has both security and budget authority)","nextMeeting":"2026-03-28","buyingSignals":["Security review passed including pen test","Verbal yes from combined CISO/CRO","Gong rejected on security grounds","Wants to go live by mid-April","Minor legal redlines only"]}'::jsonb,
  '[{"text":"Resolve liability cap clause with Robert Chambers","completed":false,"createdAt":"2026-03-21T00:00:00Z"},{"text":"Prepare mid-April onboarding timeline for 25-person team","completed":false,"createdAt":"2026-03-21T00:00:00Z"}]'::jsonb,
  '[{"title":"Legal Resolution Call","date":"2026-03-28T11:00:00Z","type":"meeting","attendees":["Robert Chambers","Rees"],"notes":"Resolve remaining liability cap clause — aim for same-day signature"}]'::jsonb,
  '2026-03-31T00:00:00Z',
  3,
  '2026-02-18T00:00:00Z',
  '2026-03-23T00:00:00Z'
);


-- ============================================================================
-- ACTIVE DEALS — Negotiation (3)
-- ============================================================================

-- Deal 23: Paramount Media Group — Negotiation — £180k
INSERT INTO deal_logs (
  workspace_id, user_id, deal_name, prospect_company, prospect_name, prospect_title,
  contacts, description, deal_value, stage, deal_type, recurring_interval,
  competitors, meeting_notes, ai_summary, conversion_score, intent_signals,
  todos, scheduled_events, close_date,
  kanban_order, created_at, updated_at
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'user_3BLvFCWBVW66GwwmThixbRAyXyj',
  'Paramount Media Group — Multi-Year Enterprise License',
  'Paramount Media Group',
  'Victoria Lane',
  'CMO / Acting CRO',
  '[{"name":"Victoria Lane","role":"CMO / Acting CRO","email":"v.lane@paramountmedia.co.uk"},{"name":"James Whitfield","role":"CFO","email":"j.whitfield@paramountmedia.co.uk"},{"name":"Natasha Price","role":"Head of Sales","email":"n.price@paramountmedia.co.uk"},{"name":"Edward Kim","role":"Procurement Director","email":"e.kim@paramountmedia.co.uk"}]'::jsonb,
  'Paramount Media Group is a large media conglomerate (£200M revenue, 500 employees) with a 90-person sales operation across 3 divisions. Victoria Lane is negotiating a multi-year deal with significant pricing pressure. Our largest potential deal at £180k/yr.',
  180000,
  'negotiation',
  'recurring',
  'annual',
  '["Gong", "Clari"]'::jsonb,
  E'## Executive Presentation — 14 Feb 2026\nAttendees: Victoria Lane (CMO/CRO), Natasha Price (Head of Sales), Rees (Halvex)\n\nParamount Media Group has 90 sales reps across 3 divisions (advertising sales, content licensing, events). Victoria oversees all commercial operations. She''s looking for a unified deal intelligence platform across all divisions.\n\nNatasha said: "Each division uses different tools — one has Gong, one has Clari, one has nothing. We need one platform that works for all three." This is a consolidation play.\n\nBudget: Victoria mentioned "significant investment" but asked for multi-year pricing before committing to a number. "If we''re doing this, we''re doing it properly — 3-year deal minimum."\n\n---\n\n## Multi-Division Demo — 28 Feb 2026\nAttendees: Victoria Lane, Natasha Price, + division leads (3 people), Rees (Halvex)\n\nDemoed the platform with use cases from each division. Advertising sales loved the email signal extraction. Content licensing liked the conversion scoring. Events team was interested in the pipeline summaries.\n\nAll three division leads were positive. Victoria said: "This is the first tool all three of my teams have agreed on. Let''s talk numbers."\n\n---\n\n## Pricing Negotiation — 14 Mar 2026\nAttendees: Victoria Lane, James Whitfield (CFO), Edward Kim (Procurement Director), Rees (Halvex)\n\nOur proposal: £180k/yr for 90 seats. Victoria asked for multi-year pricing: "I want a 3-year deal at a meaningful discount. We''re giving you stability and scale — that should be worth something."\n\nJames Whitfield (CFO) pushed harder: "I need to see this under £150k/yr for a 3-year commitment." That''s a 17% discount — aggressive but not unreasonable for a 3-year deal.\n\nWe countered: £165k/yr on a 3-year term (8% discount). Victoria said: "We''re close. Let me discuss with James and come back. Can you also include premium support at that rate?"\n\nNegotiation ongoing. Still £15k/yr apart.\n\n---\n\n## Latest Update — 21 Mar 2026\nVictoria emailed: "James will accept £170k/yr if you include premium support and quarterly executive reviews. That''s my final number." This is a good outcome — £170k x 3 years = £510k TCV.\n\nI''m reviewing internally whether we can include premium support at that rate. Need to decide by March 28.',
  'Advanced negotiation with Paramount Media Group (£180k target, likely £170k). Consolidating 3 divisions (Gong, Clari, nothing) onto one platform. Victoria Lane negotiating multi-year deal — CFO James Whitfield proposed £170k/yr with premium support on a 3-year term (£510k TCV). Decision on premium support inclusion by March 28.',
  78,
  '{"champion":"Victoria Lane (CMO/CRO)","championConfirmed":true,"budgetStatus":"negotiating","budgetAmount":"£170k/yr proposed (3-year = £510k TCV)","timeline":"Decision by end of March","decisionMaker":"James Whitfield (CFO) — final commercial authority","nextMeeting":"2026-03-28","buyingSignals":["All 3 divisions aligned","Multi-year commitment offered","CFO engaged on final terms","Consolidation play from competitors","£510k TCV potential"]}'::jsonb,
  '[{"text":"Review internally if premium support can be included at £170k/yr","completed":false,"createdAt":"2026-03-21T00:00:00Z"},{"text":"Model 3-year deal economics at £170k/yr + premium support","completed":false,"createdAt":"2026-03-21T00:00:00Z"},{"text":"Prepare counter-proposal or acceptance by March 28","completed":false,"createdAt":"2026-03-21T00:00:00Z"}]'::jsonb,
  '[{"title":"Final Terms Discussion","date":"2026-03-28T14:00:00Z","type":"meeting","attendees":["Victoria Lane","James Whitfield","Rees"],"notes":"Present decision on £170k/yr + premium support. Target: handshake agreement."}]'::jsonb,
  '2026-04-15T00:00:00Z',
  1,
  '2026-02-14T00:00:00Z',
  '2026-03-23T00:00:00Z'
);

-- Deal 24: Summit Financial — Negotiation — £120k
INSERT INTO deal_logs (
  workspace_id, user_id, deal_name, prospect_company, prospect_name, prospect_title,
  contacts, description, deal_value, stage, deal_type, recurring_interval,
  competitors, meeting_notes, ai_summary, conversion_score, intent_signals,
  todos, scheduled_events, close_date,
  kanban_order, created_at, updated_at
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'user_3BLvFCWBVW66GwwmThixbRAyXyj',
  'Summit Financial — Enterprise License',
  'Summit Financial',
  'Andrew Clarke',
  'Managing Director',
  '[{"name":"Andrew Clarke","role":"Managing Director","email":"a.clarke@summitfinancial.co.uk"},{"name":"Rebecca Moore","role":"Head of Sales","email":"r.moore@summitfinancial.co.uk"},{"name":"Chris Taylor","role":"Compliance Officer","email":"c.taylor@summitfinancial.co.uk"}]'::jsonb,
  'Summit Financial is a wealth management firm with a 40-person advisory sales team. Andrew Clarke (MD) is in final terms discussion. Compliance review passed. Negotiating payment terms and SLA specifics.',
  120000,
  'negotiation',
  'recurring',
  'annual',
  '["Clari"]'::jsonb,
  E'## Discovery — 20 Feb 2026\nAttendees: Andrew Clarke (MD), Rebecca Moore (Head of Sales), Rees (Halvex)\n\nSummit Financial manages £2B in assets with a 40-person team of financial advisors who also act as business developers (bringing in new high-net-worth clients). Andrew wants better visibility into the advisory pipeline.\n\nRebecca said: "Our advisors are brilliant with clients but terrible at updating CRM. I have no idea which prospects are close to signing until the advisor tells me." Classic CRM adoption problem.\n\nThey evaluated Clari briefly but Andrew said: "It felt too enterprise-y for us. We need something that works with how financial advisors actually operate — email and meeting notes, not Salesforce dashboards."\n\n---\n\n## Demo + Compliance Review — 5 Mar 2026\nAttendees: Andrew Clarke, Rebecca Moore, Chris Taylor (Compliance Officer), Rees (Halvex)\n\nChris Taylor (Compliance) needed to review how we handle financial client data. FCA regulations require strict data handling for wealth management firms. We walked through our GDPR compliance, data encryption, and processing agreements.\n\nChris said: "This meets our regulatory requirements. I''ll confirm in writing by end of week." Confirmed on March 7.\n\nAndrew was particularly impressed by the AI summary feature: "If I can get a one-paragraph summary of every advisory relationship every Monday morning, that transforms how I run the business."\n\n---\n\n## Final Terms Discussion — 18 Mar 2026\nAttendees: Andrew Clarke, Rees (Halvex)\n\nAndrew wants to negotiate two things:\n1. Payment terms: quarterly billing instead of annual upfront. "Cash flow matters for us — I''d prefer to spread the payments."\n2. SLA: 99.5% uptime guarantee with financial penalties. "If your platform goes down during a client meeting, it''s embarrassing for my advisors."\n\nWe agreed to quarterly billing. The SLA terms need internal review — our standard is 99.5% without financial penalties. Andrew said: "Sort out the SLA question and we''ll sign. I want this live before Q2."',
  'Final terms negotiation with Summit Financial (£120k). MD Andrew Clarke aligned on the platform after compliance review passed. Clari evaluated and rejected as too enterprise-focused. Two open items: quarterly billing (agreed) and SLA financial penalties (under review). Andrew wants to sign before Q2.',
  80,
  '{"champion":"Andrew Clarke (MD)","championConfirmed":true,"budgetStatus":"approved","budgetAmount":"£120k","timeline":"Sign before Q2 (by end of March)","decisionMaker":"Andrew Clarke (sole authority)","nextMeeting":"2026-03-26","buyingSignals":["Compliance cleared","Clari rejected — chose us","Quarterly billing agreed","Wants to go live before Q2","Only SLA terms outstanding"]}'::jsonb,
  '[{"text":"Get internal decision on SLA financial penalties for Summit","completed":false,"createdAt":"2026-03-18T00:00:00Z"},{"text":"Prepare contract with quarterly billing terms","completed":false,"createdAt":"2026-03-18T00:00:00Z"},{"text":"Send final contract by March 26","completed":false,"createdAt":"2026-03-18T00:00:00Z"}]'::jsonb,
  '[{"title":"Contract Review Call","date":"2026-03-26T16:00:00Z","type":"meeting","attendees":["Andrew Clarke","Rees"],"notes":"Present resolved SLA terms and final contract for signature"}]'::jsonb,
  '2026-03-31T00:00:00Z',
  2,
  '2026-02-20T00:00:00Z',
  '2026-03-23T00:00:00Z'
);

-- Deal 25: Redwood Analytics — Negotiation — £72k
INSERT INTO deal_logs (
  workspace_id, user_id, deal_name, prospect_company, prospect_name, prospect_title,
  contacts, description, deal_value, stage, deal_type, recurring_interval,
  competitors, meeting_notes, ai_summary, conversion_score, intent_signals,
  todos, scheduled_events, close_date,
  kanban_order, created_at, updated_at
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'user_3BLvFCWBVW66GwwmThixbRAyXyj',
  'Redwood Analytics — Platform License + API Access',
  'Redwood Analytics',
  'Elena Volkov',
  'Data Director',
  '[{"name":"Elena Volkov","role":"Data Director","email":"e.volkov@redwoodanalytics.com"},{"name":"Nikhil Mehta","role":"CTO","email":"n.mehta@redwoodanalytics.com"},{"name":"Fiona Wright","role":"VP Sales","email":"f.wright@redwoodanalytics.com"}]'::jsonb,
  'Redwood Analytics is a data analytics consultancy with a 20-person sales team. Elena Volkov (Data Director) is negotiating scope expansion — they originally evaluated for sales team only but now want API access for their data engineering team to build custom integrations.',
  72000,
  'negotiation',
  'recurring',
  'annual',
  '[]'::jsonb,
  E'## Discovery — 24 Feb 2026\nAttendees: Elena Volkov (Data Director), Fiona Wright (VP Sales), Rees (Halvex)\n\nRedwood Analytics sells data analytics consulting to enterprises. Fiona runs a 20-person sales team. Elena oversees the data infrastructure and got involved because she wants deal intelligence data flowing into their internal analytics platform.\n\nElena said: "I don''t just want a dashboard — I want access to the underlying data via API so our team can build custom analytics on top." This is an unusual but exciting use case.\n\nFiona wants the standard deal intelligence features. Elena wants API access for custom integrations.\n\nBudget: £60-80k. Elena has an additional "data infrastructure" budget that could supplement if needed.\n\n---\n\n## Technical Demo — 7 Mar 2026\nAttendees: Elena Volkov, Nikhil Mehta (CTO), Rees + our CTO\n\nDeep API demo for Elena and Nikhil. They were impressed by the API design: "This is clean. We could have our data engineers building custom dashboards within a week."\n\nNikhil asked about webhooks for real-time deal signal notifications — we confirmed this is available on the enterprise tier. He also asked about rate limits and data export formats.\n\nElena said: "I want to expand the scope. Originally we scoped this for just the sales team at £60k. But if we add API access for our 5-person data engineering team, what does that look like?"\n\n---\n\n## Scope Expansion Negotiation — 19 Mar 2026\nAttendees: Elena Volkov, Rees (Halvex)\n\nWe proposed £72k/yr for the expanded scope: 20 sales seats + API access + 5 data engineering seats. Elena said: "That''s reasonable. Nikhil and I are aligned. I just need to confirm the expanded budget with our CEO."\n\nElena expects CEO approval by end of March. She said: "This is a no-brainer for us. The sales team gets intelligence, and my data team gets a new data source for our analytics platform. Two birds, one stone."',
  'Scope expansion negotiation with Redwood Analytics (£72k, up from £60k). Data Director Elena Volkov expanding from sales-only to include API access for 5-person data engineering team. CTO Nikhil Mehta aligned on technical approach. Awaiting CEO approval on expanded budget. Unique use case — Halvex as a data source for their analytics platform.',
  75,
  '{"champion":"Elena Volkov (Data Director)","championConfirmed":true,"budgetStatus":"pending expansion approval","budgetAmount":"£72k (expanded from £60k)","timeline":"CEO approval by end of March","decisionMaker":"CEO (unnamed) for expanded budget","nextMeeting":"2026-03-27","buyingSignals":["Scope expansion = growing commitment","CTO aligned on technical approach","Two use cases (sales + data engineering)","Called it a no-brainer","API interest shows deep integration intent"]}'::jsonb,
  '[{"text":"Send expanded scope proposal to Elena for CEO presentation","completed":true,"createdAt":"2026-03-19T00:00:00Z"},{"text":"Prepare API documentation package for Nikhil''s engineering team","completed":false,"createdAt":"2026-03-19T00:00:00Z"},{"text":"Follow up on CEO budget approval by March 27","completed":false,"createdAt":"2026-03-23T00:00:00Z"}]'::jsonb,
  '[{"title":"CEO Budget Approval Follow-Up","date":"2026-03-27T10:00:00Z","type":"meeting","attendees":["Elena Volkov","Rees"],"notes":"Check on CEO approval for expanded scope, prepare to send contract"}]'::jsonb,
  '2026-04-15T00:00:00Z',
  3,
  '2026-02-24T00:00:00Z',
  '2026-03-23T00:00:00Z'
);


-- ============================================================================
-- 6. Signal Outcomes (for closed deals — ML training data)
-- ============================================================================

-- TechFlow Solutions — Won
INSERT INTO signal_outcomes (workspace_id, deal_id, outcome, close_date, champion_identified, budget_confirmed, competitor_present, competitor_name, objection_themes, sentiment_trajectory, days_to_close, total_meetings, stakeholder_count, deal_value, stage, win_reason)
SELECT 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', id::text, 'won', '2026-02-14T00:00:00Z', true, true, true, 'HubSpot native', '["integration complexity"]'::jsonb, 'improving', 45, 4, 3, 48000, 'closed_won', 'Replaced manual pipeline reviews, 3x faster deal insights'
FROM deal_logs WHERE prospect_company = 'TechFlow Solutions' AND workspace_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' LIMIT 1;

-- Meridian Capital — Won
INSERT INTO signal_outcomes (workspace_id, deal_id, outcome, close_date, champion_identified, budget_confirmed, competitor_present, competitor_name, objection_themes, sentiment_trajectory, days_to_close, total_meetings, stakeholder_count, deal_value, stage, win_reason)
SELECT 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', id::text, 'won', '2026-02-14T00:00:00Z', true, true, true, 'Clari', '["pricing","forecasting accuracy"]'::jsonb, 'improving', 60, 4, 3, 72000, 'closed_won', 'ML scoring caught 3 at-risk deals their CRM missed'
FROM deal_logs WHERE prospect_company = 'Meridian Capital' AND workspace_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' LIMIT 1;

-- NovaBridge Labs — Won
INSERT INTO signal_outcomes (workspace_id, deal_id, outcome, close_date, champion_identified, budget_confirmed, competitor_present, competitor_name, objection_themes, sentiment_trajectory, days_to_close, total_meetings, stakeholder_count, deal_value, stage, win_reason)
SELECT 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', id::text, 'won', '2026-03-12T00:00:00Z', true, true, false, NULL, '[]'::jsonb, 'improving', 30, 3, 2, 36000, 'closed_won', 'Email forwarding + signal extraction saved 5hrs/week'
FROM deal_logs WHERE prospect_company = 'NovaBridge Labs' AND workspace_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' LIMIT 1;

-- Apex Dynamics — Won
INSERT INTO signal_outcomes (workspace_id, deal_id, outcome, close_date, champion_identified, budget_confirmed, competitor_present, competitor_name, objection_themes, sentiment_trajectory, days_to_close, total_meetings, stakeholder_count, deal_value, stage, win_reason)
SELECT 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', id::text, 'won', '2026-03-20T00:00:00Z', true, true, true, 'Clari', '["procurement timeline","ROI justification"]'::jsonb, 'improving', 90, 4, 4, 96000, 'closed_won', 'Board-ready pipeline reports generated automatically'
FROM deal_logs WHERE prospect_company = 'Apex Dynamics' AND workspace_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' LIMIT 1;

-- CloudScale UK — Won
INSERT INTO signal_outcomes (workspace_id, deal_id, outcome, close_date, champion_identified, budget_confirmed, competitor_present, competitor_name, objection_themes, sentiment_trajectory, days_to_close, total_meetings, stakeholder_count, deal_value, stage, win_reason)
SELECT 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', id::text, 'won', '2026-03-14T00:00:00Z', true, true, true, 'Gong', '["call recording vs text"]'::jsonb, 'improving', 40, 3, 2, 54000, 'closed_won', 'Playbook from closed deals improved win rate by 22%'
FROM deal_logs WHERE prospect_company = 'CloudScale UK' AND workspace_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' LIMIT 1;

-- Ironforge Industries — Lost
INSERT INTO signal_outcomes (workspace_id, deal_id, outcome, close_date, champion_identified, budget_confirmed, competitor_present, competitor_name, objection_themes, sentiment_trajectory, days_to_close, total_meetings, stakeholder_count, deal_value, stage, loss_reason)
SELECT 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', id::text, 'lost', '2026-03-20T00:00:00Z', false, true, true, 'Gong', '["call recording requirement","feature gap"]'::jsonb, 'declining', 75, 3, 3, 120000, 'closed_lost', 'Chose Gong — wanted call recording not text analysis'
FROM deal_logs WHERE prospect_company = 'Ironforge Industries' AND workspace_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' LIMIT 1;

-- BlueHorizon Media — Lost
INSERT INTO signal_outcomes (workspace_id, deal_id, outcome, close_date, champion_identified, budget_confirmed, competitor_present, competitor_name, objection_themes, sentiment_trajectory, days_to_close, total_meetings, stakeholder_count, deal_value, stage, loss_reason)
SELECT 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', id::text, 'lost', '2026-03-17T00:00:00Z', true, false, false, NULL, '["budget freeze","timing"]'::jsonb, 'declining', 20, 2, 2, 24000, 'closed_lost', 'Budget frozen — postponed all new tooling to Q3'
FROM deal_logs WHERE prospect_company = 'BlueHorizon Media' AND workspace_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' LIMIT 1;

-- Quantum Retail — Lost
INSERT INTO signal_outcomes (workspace_id, deal_id, outcome, close_date, champion_identified, budget_confirmed, competitor_present, competitor_name, objection_themes, sentiment_trajectory, days_to_close, total_meetings, stakeholder_count, deal_value, stage, loss_reason)
SELECT 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', id::text, 'lost', '2026-03-18T00:00:00Z', true, true, false, NULL, '["build vs buy","CTO preference"]'::jsonb, 'stable', 50, 3, 3, 60000, 'closed_lost', 'Internal build — CTO wanted custom solution'
FROM deal_logs WHERE prospect_company = 'Quantum Retail' AND workspace_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' LIMIT 1;


COMMIT;
