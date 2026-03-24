-- 005_mcp_flow_improvements.sql
-- Closes MCP loop gaps identified in P1/P2/P3 audit

-- Store which deal objection/risk each Linear issue addresses
-- Set during halvex_discover_issues and halvex_bulk_scope_to_cycle
ALTER TABLE deal_linear_links ADD COLUMN IF NOT EXISTS addresses_risk TEXT;

-- Track when a Slack "all shipped" summary was sent so we don't double-send
ALTER TABLE deal_linear_links ADD COLUMN IF NOT EXISTS slack_notified_at TIMESTAMPTZ;
