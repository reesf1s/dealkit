-- Phase 4: Closed Loop — deployment detection, proactive DM, release email
-- Track which Slack message to edit in-place when an email is generated

ALTER TABLE mcp_action_log ADD COLUMN IF NOT EXISTS slack_message_ts text;
ALTER TABLE mcp_action_log ADD COLUMN IF NOT EXISTS slack_channel_id text;
