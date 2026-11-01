# Chatlas implementation plan

1. Establish the TypeScript workspace and a polished, explicitly synthetic Demo shell.
2. Implement SQLite sessions, topic evidence, persistent transactional approval voting, and tests.
3. Add OAuth, encrypted tokens, EventSub subscriptions, recovery, and moderation.
4. Add bounded worker analysis, visible lexical fallback, editable topics, and retention.
5. Add restricted OBS credentials, role-specific snapshots, and safe overlay layouts.
6. Validate browser flows, restart persistence, load behavior, and document operational limits.

Real Twitch and OBS acceptance require external credentials and consenting participants. No synthetic result will be described as live acceptance. The supplied specification remains the acceptance target; BUILD_LOG.md records actual coverage and gaps.

## Current checkpoint

The local Demo, persistence, voting, moderation, replay, dashboard, read-only overlay, and production startup/restart path are implemented and tested. OAuth/EventSub and optional model-provider code are present; real Twitch, downloaded-model inference, and actual OBS are external acceptance dependencies, not completed milestones. BUILD_LOG.md is the authoritative check record. Independent human evaluation, sustained visual performance measurement, and optional outgoing writes remain future work.
