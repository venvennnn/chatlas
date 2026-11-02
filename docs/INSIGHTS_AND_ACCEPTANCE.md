# Insights, reports, and stream acceptance

## Investigate a topic

The Live room shows changes between consecutive 60-second periods. Changes require a difference of at least two distinct contributors. Emerging means zero contributors in the prior minute, not that the topic has never existed. These are observed counts, not sentiment or consensus.

Click or keyboard-activate any ten-second point in the top-four charts to open its private evidence. The selected window is frozen while charts continue updating. The server retains approximately 60 seconds of window references; older requests return an expiration message. Deleted messages disappear from evidence. A bucket returns at most 100 messages with its actual total and contributor count; this is not a full-history export.

Choose **Create vote draft** on a chart, **Draft vote** on an insight, or the inspector's decision button. Recognized topic mentions seed editable options. Review question/options; publishing remains an explicit action. With **Each message is a unique contributor** enabled, every valid vote message is a simulated voter. Repeated messages count separately; duplicate deliveries of the same message do not. `!vote clear` removes that account’s preceding test ballots. Disabling the option recomputes open decisions per account, while closed decisions retain their counting mode and frozen totals. Keep test mode off for real audience votes.

Extracted topic labels name recurring subjects, including new entities and multiword phrases. They require repeated contributor support and are not semantic summaries. Unknown subjects remain private until the owner explicitly approves the label for the overlay; generic fallback labels are retained when evidence is too sparse. Language-pattern counts use conservative English lexical rules for suggestion, disagreement, and question markers. They are not sentiment analysis and may overlap.

## Overlay customization

In Overlay, choose Cozy studio, Gameplay safe, or Minimal. Adjust size, card opacity, character visibility, 1–4 topics, and safe margin. Preview changes stay local until **Apply overlay style**. Saved settings persist across restarts and reach existing read-only sources on the next snapshot. Size and margin apply to the OBS source; the in-app preview fits its own container.

The Compact overlay and its in-app preview now render one fixed design canvas, scaled uniformly to fit. A narrow OBS source keeps the same three-column composition instead of switching to a phone layout. Empty slots show waiting states; Chatlas never invents topics or counts. **Use reference design** restores the reference preset and selects Compact. Existing OBS sources must use the Compact layout URL for this composition. Extracted topic labels require explicit approval before appearing publicly.

## Session recaps

In Session history, open **View recap & decisions**. Recaps retain aggregate samples every 15 seconds while analysis runs, up to 2400 samples per session. Samples contain topic labels/counts, window participation, coverage, and whether contributor counting was simulated. No raw text or usernames are copied into samples. Deleting a session cascades its samples.

Labels are grouped across re-clustering in recaps, and each peak is the largest observed cluster for that label, never a sum of overlapping participants. Topic peak counts refer to rolling two-minute windows, not unique participants across the entire stream. Samples can miss short spikes; topic identities may change after resets; old sessions have no retroactive samples. The HTML report is a locally downloaded shareable artifact, not an automatically published page. Review it before sharing. JSON includes sampled trends and decision outcomes. Closed decisions remain available separately.

## Evaluate grouping and language rules

Run:

```sh
npm run evaluate:topics -- fixtures/topic-evaluation.example.json /tmp/chatlas-topic-evaluation.json
```

The supplied 16-record fixture is synthetic regression coverage only. To measure real quality, obtain a diverse, consented, independent human-reviewed dataset. Copy the JSON format, set `provenance` to `human-reviewed` only after actual review, and label topic plus the three intent flags. Include negation, paraphrases, competing games, sparse topics, emotes, ambiguous messages, and unsupported languages. Keep tuning and held-out evaluation records separate. Every input record represents one distinct contributor; topic promotion requires three contributors. The CLI reports assignment coverage, pairwise grouping precision/recall, and intent TP/FP/FN. Provenance is declared by the dataset author, not authenticated by the CLI. Do not present synthetic scores as human or real-world validation. Cached semantic inference needs its own evaluation.

## Real Twitch → Chatlas → OBS acceptance

Local automated tests simulate Twitch transport; they do not establish real integration acceptance. This environment has no configured Twitch client credentials or local OBS installation at implementation time.

1. Register the confidential Twitch application following TWITCH_SETUP.md. Put credentials in secure environment settings, never chat or source. Set the callback to the exact public APP_ORIGIN + `/auth/twitch/callback`. Keep generated session/encryption secrets private.
2. Authorize the owner and choose Start live ingestion. In Settings, recheck the connection panel. Configured/authorized/subscribing are distinct from receiving actual Live chat.
3. With consenting participants, send messages about multiple topics. Confirm Live status, actual counts, timestamped evidence, coverage, and processing age. Do not relabel Demo as Live.
4. Create an editable topic-based draft, publish, submit `!vote 1 3`, replace with `!vote 2`, verify one voter, close, and reload to verify the result.
5. Generate a private overlay link and paste it into an OBS Browser Source at 1920×1080. Confirm topic updates, votes/results, transparent edges, all presets, safe margins, and character visibility in the actual OBS preview. Chatlas cannot detect local OBS rendering; its readiness panel explicitly leaves this manual check unverified.
6. Disconnect/reconnect the source and network. Verify the stale indication, recovery, gap count, no fabricated fill, and expired-link behavior after rotation. Restart the app and verify saved settings, recaps, and closed results.
7. Record the real environment, date, source, consenting test-account count, observed outcomes, and remaining failures. Never record tokens or private overlay URLs in the report.

Required destinations are HTTPS `id.twitch.tv`, `api.twitch.tv`, `dev.twitch.tv` and secure WebSocket `eventsub.wss.twitch.tv`. Configuration and OAuth must be supplied before the real acceptance run. No outgoing chat messages are sent automatically.
