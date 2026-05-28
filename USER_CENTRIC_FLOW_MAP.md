# Halvex V2 User-Centric Flow Map

Halvex should be a simple manual CRM with AI intelligence on top, not an AI system that secretly runs the CRM.

## Product Rule

The user owns the CRM record. Halvex reads the record, explains what it sees, and recommends next moves. Important changes are explicit and reversible.

AI can:
- summarise evidence
- explain risk
- recommend a next action
- recommend a task
- draft a follow-up
- highlight missing or stale information

AI should not:
- silently create tasks
- silently change stages
- silently overwrite deal facts
- treat stale imported tasks as current truth
- mix context from another deal into a record-level answer

## Core Deal Flow

1. Update deal facts manually.
2. Manage tasks manually.
3. Upload new evidence manually, such as a meeting note, email snippet, call note, blocker, or buyer update.
4. Halvex proposes insight changes from that evidence.
5. User approves the insight update, saves the evidence only, or creates a recommended task explicitly.
6. Halvex recalculates score, confidence, risk, and next action from the latest accepted evidence.

## Page Jobs

Home: show what needs attention today and let users complete real tasks quickly.

Inbox: review new or uncertain information before it changes CRM memory.

Calendar: prepare for meetings and capture post-meeting evidence.

Deals: manage pipeline state, inspect intelligence, and find missing data.

Deal Workspace: manual record management plus grounded deal intelligence.

People: relationship memory and last-touch context.

Companies: account memory across people, deals, meetings, and open risk.

Assistant: natural-language interface for explaining, drafting, and proposing changes, with links and evidence.

Settings: quiet operational controls.

## Current Product Decisions

- AI task creation has been removed from approved deal updates.
- AI task recommendations are shown as recommendations only.
- Users can explicitly create a task from a recommendation.
- Deal task management is now a first-class part of the Deal Workspace.
- Evidence upload is framed as feeding the intelligence layer, not as an automatic update machine.
