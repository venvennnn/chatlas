# Chatlas end to end technical specification

## 1 Purpose and instructions for Codex

Build Chatlas, a complete Twitch companion that turns fast chat into a readable conversation and lets participating viewers make transparent community decisions. Tagline: **See what chat is saying. Decide together.**

This document is the implementation brief for a fresh Codex session. Inspect the repository and applicable AGENTS.md first. Create a new project when the directory is empty; preserve unrelated existing work. Implement the application, tests, documentation, and operational setup, rather than stopping at a plan or visual mockup. Resolve routine choices independently. Ask only for unavailable credentials or decisions that materially block progress. Never invent successful Twitch connections or test results.

Create SPEC.md, IMPLEMENTATION_PLAN.md, and BUILD_LOG.md. Keep the main build in one Codex thread. Record meaningful implementation decisions and actual Codex contributions for the hackathon description and video. Never invent a session ID; the user obtains it using /status in the main build session.

## 2 Product boundaries

Deliver two connected modes:

**Pulse:** A live, stable map of themes, questions, suggestions, and emote waves, with inspectable message evidence.

**Decide:** The streamer selects or writes options, publishes an explicit approval vote, and displays the result.

The product serves a broadcaster operating the dashboard and viewers participating through ordinary Twitch chat. Viewers need no additional account, browser extension, payment, or companion website. Passive viewers should understand the overlay without reading chat.

Do not describe participating chatters as the silent majority or representative of all viewers. Topic mentions are not votes. Earliest observed contributors are not proven originators. Exclude native Channel Points polls, paid influence, game telemetry, automated stream control, and cross-channel Shared Chat aggregation from version one.

## 3 Success scenario

A streamer asks, “What should we play next?” Chat contains suggestions, disagreement, jokes, and repeated messages. Pulse groups related discussion while preserving raw volume and distinct-participant counts. The streamer inspects evidence and selects three candidate games, editing the labels before publication.

Decide displays numbered options and instructions. Viewers submit `!vote 1 3` to approve options one and three. One account contributes at most one current approval per option. Repeating messages adds no voting influence. When voting closes, Chatlas shows approval counts, the number of valid voters, and any tie. The streamer decides what to do next; Chatlas never launches a game automatically.

## 4 Architecture and repository

Use a TypeScript workspace with React, Vite, Tailwind CSS, accessible headless controls, and restrained SVG animation. Use Fastify for HTTP, a WebSocket library for browser updates and Twitch EventSub, SQLite with migrations for persistence, and Zod for boundary validation. Install supported stable dependency versions, verify compatibility, and commit the lockfile. Use an actively supported Node LTS version recorded in .nvmrc.

Organize packages as `apps/web`, `apps/server`, and `packages/shared`. Server modules should separate authentication, Twitch transport, normalization, analysis, decisions, persistence, and browser broadcasting. Keep embedding inference in a worker so it cannot block votes or connection health.

Serve the production frontend and API from one origin. During development, Vite proxies API, auth, and WebSocket paths to the backend. Start with one process and one broadcaster per installation. Route all state through an explicit session ID so multiple sessions remain isolated. Container deployment uses one persistent volume and one replica; horizontal scaling is deferred.

## 5 Local setup and configuration

Provide `npm run dev`, `build`, `start`, `lint`, `typecheck`, `test`, and `test:e2e`. Document Windows PowerShell and macOS/Linux commands. Include .env.example, .gitignore, database migrations, Dockerfile, and a health check.

Configuration: `APP_ORIGIN`, `PORT`, `DATABASE_PATH`, `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `SESSION_SECRET`, `TOKEN_ENCRYPTION_KEY`, `EMBEDDING_MODEL`, and `MODEL_CACHE_DIR`. Derive the callback as APP_ORIGIN plus `/auth/twitch/callback`. Validate configuration with readable errors. Generate secrets locally; never put them in frontend bundles, screenshots, logs, or committed files.

The initial application must run in clearly labeled Demo mode without Twitch credentials. Live mode requires authorization and received events. Missing model files must produce setup instructions or an explicitly labeled fallback, never a fake semantic-analysis status.

## 6 Registering and connecting Twitch

Write a step-by-step TWITCH_SETUP.md matching the implemented routes. In the Twitch developer console, register a uniquely available application name such as Chatlas by Venmani, category Website Integration, and client type Confidential because the backend stores the secret. Enable required account verification and two-factor authentication.

Register the exact callback URL, including protocol, port, and path. Development defaults may use `http://localhost:5173/auth/twitch/callback` only if the console accepts that localhost exception. If HTTPS is required, use a trusted local HTTPS origin or an HTTPS tunnel to the same application. Register that origin and open the dashboard there. Production always uses HTTPS. Explain redirect-mismatch troubleshooting.

Implement authorization-code OAuth with an expiring, single-use state bound to the initiating browser. Exchange codes server-side, validate the returned identity, and create an HttpOnly session cookie. The initial connection requests `user:read:chat`; optional outgoing messages additionally request `user:write:chat` with explicit broadcaster opt-in. Authenticate as the broadcaster and target their own channel; a separate bot account is unnecessary for this version.

Encrypt persisted Twitch tokens using authenticated encryption. Validate on startup and hourly, refresh using a single-flight operation, persist rotated refresh tokens, and terminate invalid sessions. Disconnect must stop ingestion, invalidate dashboard sessions and overlay credentials, and clear stored tokens. Verify exact scopes against current official documentation before implementing. [1–3]

## 7 EventSub ingestion and recovery

Use EventSub WebSockets with the broadcaster’s user access token. After receiving the welcome session ID, create authorized subscriptions through Helix. Subscribe to chat messages, message deletion, per-user message clearing, and room clearing. For the initial own-channel flow, broadcaster_user_id and the authorized user_id are the broadcaster’s ID. Never send subscription requests through the Twitch WebSocket itself. [2,4]

Implement explicit connection states: disconnected, authorizing, connecting, subscribing, live, reconnecting, and authorization required. Handle welcome, keepalive, notification, reconnect, revocation, and close messages. Follow Twitch’s migration procedure for instructed reconnects; on an ordinary lost connection establish a new session and recreate subscriptions. Deduplicate deliveries. Show an ingestion-gap marker because disconnected events are not replayed. [4]

Keep chat writes optional. Send only user-requested voting instructions and results, honoring API rate limits and actual send responses. Prevent loops by excluding the authorized broadcaster’s command responses from analysis. Shared-origin messages should be filtered or visibly excluded in version one.

## 8 Data model and retention

Persist ChannelConnection, DashboardSession, AnalysisSession, ChatMessage, Topic, TopicMembership, Decision, DecisionOption, VoteRevision, OverlayCredential, and AuditEvent. Use foreign keys and transactional updates. Store Twitch identifiers as strings.

Messages record channel/session IDs, Twitch message ID, sender ID, optional display name, source timestamp, arrival timestamp, text, emote fragments, deletion state, and source mode. Uniqueness on session plus Twitch message ID prevents duplicate processing. Track EventSub delivery IDs separately. All browser payloads carry a schema version and state revision.

Default to a 120-second analysis window and 24-hour raw-message retention. Purge raw text, embeddings, and expired membership rows automatically; retain only necessary aggregates. Keep vote revisions until the associated session is deleted. Document these defaults and provide Delete session data. Do not record audio, video, IP-based identity profiles, or private messages.

## 9 Pulse analysis pipeline

Normalize Unicode and whitespace while preserving original evidence. Retain emote identifiers. Detect commands first and route them outside topic clustering. Avoid treating repeated punctuation, emote-only messages, or short reactions as ordinary semantic sentences. Deduplicate normalized text for embedding work, while retaining every message’s provenance and raw-volume count.

Implement an EmbeddingProvider interface. Default to a compact English sentence-embedding model supported by Transformers.js in a Node worker, with normalized vectors and cached weights. Validate its license and actual runtime compatibility. Batch requests, bound the queue, cache repeated texts, and disclose first-download size and progress. Offer a lexical TF-IDF fallback visibly marked Limited semantic grouping. Do not silently switch model spaces within existing centroids. [5]

Use online cosine-similarity assignment to active topic centroids. Start with a configurable 0.72 similarity threshold as a tuning hypothesis, not a validated universal constant. Require several distinct contributors before promoting a topic. Keep unmatched messages in an ungrouped pool. Give each sender bounded centroid influence so repeated messages cannot steer a topic’s meaning.

Expire memberships using the analysis window and recompute statistics incrementally. Merge close clusters only when representative evidence supports the same topic; keep merge lineage. Stable topic IDs and position anchoring prevent visual reshuffling. Limit visible islands to eight, with an Other discussion summary.

Opposing views about one subject may share a topic, but labels must remain neutral: “Minecraft discussion,” not “Play Minecraft.” Preserve disagreement examples. Suggestion extraction should require explicit markers or streamer selection. Use extractive labels from representative messages initially; manual rename, merge, split, hide, and pin controls are required. Do not make sentiment or sarcasm claims from embedding similarity alone.

## 10 Metrics and interpretation

For each topic show message count M, distinct contributors U, representative messages, and activity trend. Repetition share equals `(M − U) / M` when M is positive. Label this repetition, not proven spam or malicious behavior.

Contributor share is U divided by distinct participants across the active window. People can discuss multiple topics, so topic shares need not total 100 percent. Explain the denominator in a tooltip. Topic area defaults to U; a streamer may switch to raw volume with an obvious mode label.

Show a per-topic sparkline of distinct contributors by time bucket and a simple change from the previous equal window. Describe it as activity growth, not virality or causal contagion. Emote waves use separate counts and breadth metrics. Do not publish an opaque engagement score. Low-volume sessions should say “Waiting for more conversation” rather than fabricate meaningful clusters.

## 11 Explicit approval voting

Decision states are draft, open, closed, and cancelled. Permit one open decision per channel, two to five frozen options, and a configurable 30–300-second duration. The streamer edits the question and options before opening. Changing published options requires cancellation and a new decision.

Supported commands are `!vote 1 3`, `!vote clear`, and `!chatlas`. Parse only complete, valid commands; malformed input never changes an existing ballot. Each valid command replaces that sender’s complete approval set. Enforce a unique current ballot per decision and Twitch user ID. Subscribers, donors, moderators, and ordinary viewers receive equal vote weight.

Use an explicit server deadline. Accept commands only while open, received before closing, and with source timestamps inside the voting interval. Order revisions deterministically by source time, arrival sequence, and message ID. Reject stale out-of-order replacements. Use database transactions so a closing decision cannot accept concurrent votes.

Option approval equals accounts currently approving it divided by accounts with nonempty ballots. Percentages may sum above 100 percent. State that clearly. Clearing a ballot removes that voter from the denominator. Zero votes produce no winner; ties remain ties. The streamer may acknowledge a result but cannot silently rewrite it. This is fairness per Twitch account, not verified human identity or protection against multiple accounts.

## 12 Moderation and trustworthy output

Treat every chat message as untrusted input. Escape all rendering, validate lengths and enums, and never execute commands derived from chat text. If optional language-model labeling is added later, constrain it to structured outputs and treat prompt-like messages as data.

On message deletion, remove evidence and invalidate affected memberships and derived labels. Clearing a user removes their active evidence. Clearing the room clears active discussion. Maintain tombstones for out-of-order deliveries. For open votes, remove deleted vote revisions and reconstruct the ballot from remaining valid revisions. Freeze aggregate results at close; later moderation removes personal evidence without silently changing the announced result. Audit this policy.

Provide Hide topic and Pause public overlay actions. Before overlaying verbatim messages or usernames, require a streamer setting; default to neutral aggregate labels. Topic publication should use streamer-approved labels or a constrained safe label set until reviewed. The dashboard can display escaped evidence privately. Suppression is scoped and auditable.

## 13 Dashboard design

Use a white background, near-black typography, subtle gray dividers, cobalt as the primary accent, and restrained coral for attention. Avoid purple gradients, neon styling, dense metric cards, and underscores in user-facing names. Use a clean sans-serif with tabular numerals. Maintain accessible contrast and visible focus.

The main page has a compact navigation rail: Live room, Decisions, Session history, and Settings. Its header shows channel, session, source mode, connection state, and Start or End session. Central space belongs to the topic atlas. A right inspector shows selected-topic evidence and controls. A shallow bottom timeline shows activity and connection gaps.

Islands grow gently with distinct contributors. Labels remain legible and positions stable. Selecting an island opens evidence, counts, and Add to decision. New arrivals should create subtle pulses, not constant movement. Offer reduced motion, keyboard navigation, and a list view with the same information. Include empty, loading, disconnected, model-loading, and error states.

The decision composer previews numbered options and chat instructions. Results show counts before decorative animation. Streamer controls remain on the dashboard; viewers should never see technical configuration or debugging statistics on the overlay.

## 14 OBS overlay

Provide a transparent browser-source route in compact Pulse, expanded Atlas, Voting, and Results layouts. Preview against light and dark sample footage. Design for a 1920×1080 canvas, configurable placement, and readable broadcast-sized text. Default to a compact panel that leaves most content unobstructed.

Generate a random read-only overlay credential, store only its hash, and support rotation. Put the credential in the URL fragment; exchange it for a restricted session through a same-origin bootstrap request. Strip it from browser history and redact all credential logs. Authenticate overlay HTTP and WebSocket access, enforce origins, and authorize every message type. Overlay credentials must never grant dashboard mutation rights.

Document OBS Browser Source setup, dimensions, transparency, refresh behavior, and preview testing. Lost connections show a restrained stale indicator; a stale overlay must not imply a vote is still open. Refreshing OBS restores the current server snapshot without repeating celebrations.

## 15 API and real-time contracts

Implement auth start/callback/disconnect, current connection, session start/end/delete, topic inspection and edits, decision create/open/close/cancel, overlay credential rotation, settings, health, and replay controls. Use REST mutations with validation and idempotency keys for consequential transitions. Only authenticated owner sessions can mutate state; protect cookie-authenticated writes against CSRF.

Broadcast snapshot, topic update, decision update, connection status, and analysis status events. Send only role-appropriate fields. Reconnecting clients receive a complete snapshot and revision; they ignore older revisions. Batch visual updates approximately once per second, while ballot persistence happens immediately. Keep owner and overlay subscription channels separate.

## 16 Performance and evaluation

Target a measured reference workload of 50 messages per second sustained and 200 per second for short bursts. These are engineering targets, not claimed achievements. Prioritize command parsing, moderation, and vote persistence over embedding work. Backpressure may sample semantic analysis, but must show analysis coverage and preserve unsampled vote ingestion. Counters must not silently mix sampled and complete populations.

Measure message-to-persist latency, embedding queue depth, topic-update latency, memory, and frame rate on declared hardware. Aim for sub-second local vote visibility and topic updates within three seconds under the reference workload. Report achieved results honestly.

Create a human-labeled evaluation set covering paraphrases, opposing stances, unrelated topics, emotes, and repetition. Compare semantic grouping with lexical grouping using pairwise precision/recall and cluster stability. Use licensed public data or explicitly consented captures for realistic evaluation. Synthetic fixtures are allowed for tests but must never be presented as actual audience evidence.

## 17 Tests and replay

Unit tests must cover duplicate delivery, expiry, distinct counts, contradictory mentions, valid and malformed ballots, replacements, clearing, stale ordering, deadlines, ties, deletion rollback, token-state rejection, and authorization boundaries. Integration tests simulate EventSub welcome, reconnect, revocation, token refresh, SQLite restart, and browser snapshot recovery.

Use Playwright for Demo mode, evidence inspection, decision publication, ballot results, keyboard access, and read-only overlay restrictions. Add a bounded load test that exercises analysis pressure while votes remain correct.

Replay files use timestamped JSONL through the same normalized pipeline, with a separate source namespace. Synthetic examples display DEMO throughout. Consented recordings display REPLAY. Never mix replay identities or events into a live decision. Provide pause, speed, reset, and a deletion-race fixture. Document fixture provenance. Real Twitch authorization and actual received messages remain mandatory manual acceptance checks.

## 18 Implementation milestones and delivery

Build sequentially: repository foundation and polished Demo shell; real OAuth and EventSub ingestion; persistent explicit voting; semantic Pulse analysis; moderation and recovery; OBS overlay; evaluation and end-to-end acceptance. After each milestone, update BUILD_LOG.md with completed checks, known limitations, and the next dependency. Do not substitute an attractive replay for an unfinished live path.

Deliver README.md, TWITCH_SETUP.md, OBS_SETUP.md, architecture notes, migrations, .env.example, tests, evaluation results, and a three-minute demo script. Include troubleshooting for redirect mismatch, missing scopes, model download failure, expired authorization, empty chat, and OBS connection issues.

Local operation is the default. Provide a Docker deployment path for a persistent Node host with HTTPS, outbound Twitch connectivity, model cache, backups, and SQLite volume. Do not deploy the persistent connection worker to request-only serverless functions. Prepare deployable assets before requesting any genuinely necessary hosting action.

The live acceptance walkthrough must connect the owner’s Twitch account, receive real viewer messages, group an observable topic, publish a vote, replace one ballot without increasing weight, close it accurately, and display the result in OBS. Use consenting test participants and their real accounts. A closed decision must survive restart.

## 19 Hackathon submission

Build the submitted project during the permitted submission period. Keep Chatlas distinct from Backseat Court and Prediction Lab: its primary interaction is collective sense-making and explicit decision-making.

Record a 150–175-second video: brief audience problem, actual Twitch chat flowing into the atlas, a repeated-message example, an explicit vote and result, then real footage explaining Codex’s contribution. Synthetic or replay footage must remain labeled. Include the repository, setup instructions, description, and main build-thread session ID. Public or unlisted YouTube is acceptable under the organizer update. Confirm Submitted status. Freeze submitted repository, video, and links after the deadline until winners are announced. [6]

The deadline is November 2, 2026 at 2 PM Pacific, equivalent to November 3 at 3:30 AM IST. Assess innovation, impact, implementation, and design equally. Emphasize the actual working experience rather than unsupported audience-reach percentages or claimed engagement uplift.

## Official implementation references

Checked 1 November 2026. Recheck these sources when implementing; requirements and libraries can change.

1. Twitch registration and authorization: https://dev.twitch.tv/docs/authentication/register-app/ and https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/
2. Chat authentication and subscription scopes: https://dev.twitch.tv/docs/chat/authenticating/ and https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/
3. Token validation and refresh: https://dev.twitch.tv/docs/authentication/validate-tokens/ and https://dev.twitch.tv/docs/authentication/refresh-tokens/
4. EventSub WebSocket lifecycle: https://dev.twitch.tv/docs/eventsub/handling-websocket-events/
5. Transformers.js documentation: https://huggingface.co/docs/transformers.js/
6. Organizer requirements: https://twitchcon-codex.devpost.com/rules and https://twitchcon-codex.devpost.com/updates/47341-final-weekend-make-your-project-come-alive
