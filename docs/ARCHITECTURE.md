# Architecture and invariants

`apps/web` is React/Vite/Tailwind with Radix's accessible dialog and restrained SVG charts. `apps/server` is Fastify, `ws`, Zod, and Node 24 SQLite. `packages/shared` contains snapshot contracts, normalization, and the complete ballot parser. Production serves one origin; Vite proxies development traffic.

## State

One installation binds one broadcaster and permits one open vote. Every message, decision, topic membership, and replay event has an explicit analysis session ID. SQLite WAL, foreign keys, and synchronous transactional mutations serialize ballot persistence and closure. Migrations are idempotent SQL under `apps/server/migrations`; the current migration is schema version 1.

`store.ts` owns persistence, idempotent message ingestion, retention, moderation, deterministic ballot revision ordering, and frozen results. Current ballots are reconstructed from non-deleted revisions ordered by source timestamp, arrival sequence, and message ID. A valid vote must arrive before the server deadline and carry a source timestamp inside the published interval. Clearing produces an empty current set and leaves the voter out of the denominator. Closed aggregates are frozen; later moderation removes personal evidence without silently rewriting the result.

Delivery IDs are separate from chat-message IDs. Deletion tombstones and user/room clear boundaries handle later out-of-order messages. Moderation invalidates labels and worker generations so an obsolete worker response cannot restore removed evidence. Session deletion cascades dependent rows and removes its audit records.

## Analysis

The Node worker tries a locally cached Transformers.js MiniLM q8 CPU model. Startup never initiates an implicit download. Missing or failed weights select an explicitly disclosed lexical TF-IDF space. Runtime inference errors do not mix lexical vectors into existing semantic centroids. Semantic batches are limited to 16, with 256 new texts per update and a 4096-text cache. The main thread sends at most 12000 active messages per worker update; commands persist independently. Coverage is disclosed when sampling/inference limits apply. The small synthetic load test is not a validation of indefinite peak throughput.

Clusters retain anchored slots, use cosine assignment, and bound centroid contributions by sender. Memberships expire with a 120-second window. Commands, short reaction noise, and emote-only messages receive separate treatment. A normal topic needs three contributors; manual splits may contain fewer. Safe labels or explicit owner edits are publishable. Merge/split membership overrides and lineage are persisted. Automated cross-cluster merging and independent human evaluation are not implemented.

## Trust boundaries

Opaque 256-bit dashboard/overlay credentials are stored as hashes. Cookies are HttpOnly, SameSite=Lax, and Secure on HTTPS. Every dashboard write requires owner authentication, exact configured Origin, and a custom CSRF header. Consequential transitions require an idempotency key with matching request content. Anonymous bootstrap is restricted to the synthetic, never-authorized installation. Once the Twitch owner is bound, bootstrap is disabled and future OAuth identities must match that owner.

OAuth state expires after ten minutes, is tied to a separate initiating-browser cookie, and is consumed once. Tokens use authenticated AES-256-GCM encryption with a locally generated key; secret values never enter frontend bundles. There is no chat-derived code execution or optional LLM labeling. React escapes all message evidence.

Overlays exchange a fragment credential for a distinct read-only cookie. HTTP and WebSocket endpoints enforce role and origin. Incoming client WebSocket messages are rejected: mutations go through validated REST. The server sends full role-filtered snapshots approximately once per second with a schema version and increasing revision. Clients discard older revisions; refreshed/reconnected clients obtain complete snapshots. Expired/rotated sessions close. Slow consumers are disconnected instead of accumulating unbounded buffered messages.

## Operations and known limits

One process, one replica, one writable SQLite/model-cache volume. Processes must restart after environment restoration. No request-only serverless deployment, horizontal scaling, Shared Chat aggregation, native polls, paid influence, telemetry, or automatic stream control. Outgoing Twitch chat writes are intentionally not enabled. Actual Twitch and OBS acceptance, cached semantic inference, model-quality/stability evaluation, long-duration load, and frame-rate measurements remain external checks. See the build log for actual results rather than inferring readiness from this design.
