# Fixture provenance

All bundled chat, replay, and evaluation fixtures were authored synthetically by Codex for this project on 2026-11-01. They are not actual audience evidence and carry no participant consent claim. Use `deletion-race.jsonl` in DEMO mode. It covers deletion arriving before the corresponding message and rollback of an open vote replacement. Publish a 3-option vote before importing to exercise the vote sequence.

User-supplied recordings must have explicit participant consent, must not contain private messages, and run in the separate REPLAY namespace. Imported offsets are milliseconds; playback maps them to local arrival/source time. A replay never targets a live decision.
