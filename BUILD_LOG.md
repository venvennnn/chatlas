# Build log

## Foundation — 2026-11-01

- Read the supplied specification and inspected the empty checkout; no existing application or AGENTS.md was present.
- Selected Node 24 LTS, React 19, Vite 7, Fastify 5, SQLite via Node's built-in driver, and a TypeScript workspace.
- Codex authored the initial architecture and implementation in this main thread. No session ID is inferred.
- Official Twitch documentation requests were blocked by current network policy (HTTP 403); required destinations were saved to the environment draft. Live scope verification remains pending until access is available.

## Implemented local workflow

- React/Vite/Tailwind dashboard: stable topic islands, private evidence inspector, neutral labels, people/volume sizing, list view, activity timeline, session history, and settings. Radix decision dialog supports keyboard focus and reduced-motion styles. Secondary text contrast was increased during visual review.
- Fastify/Zod/SQLite API with migration, explicit session namespaces, immediate transactional message/vote persistence, deterministic complete-ballot replacement, deadlines, ties, deletion rollback, and frozen closed results.
- Isolated analysis worker, bounded inference/cache, a typed MiniLM provider, and visibly labeled lexical TF-IDF fallback. Manual rename, pin, hide, merge, evidence split, and lineage audit are implemented. Moderation clears stale generations and retained in-worker vectors.
- OAuth state binding, confidential server exchange, encrypted tokens, owner binding, single-flight refresh, startup/hourly validation, EventSub subscription/recovery/revocation handling, source filtering, and explicit WebSocket proxy support. These paths have simulated coverage; no actual Twitch connection occurred.
- Read-only OBS credential exchange in the fragment, separate cookies/WebSocket roles, credential rotation, transparent page background, four layouts, light/dark preview, optional verbatim evidence, pause, and stale status.
- JSONL replay with source provenance, pause/speed controls, separate identities, and a bundled synthetic deletion-race fixture. Synthetic input is rejected in consented Replay and Live sessions.
- Setup, Twitch, OBS, architecture, deployment, fixture provenance, and 165-second recording documentation. Docker/Compose assets exist; no container or external deployment has been run.

## Validation completed — 2026-11-01

- Clean `ONNXRUNTIME_NODE_INSTALL=skip npm ci` succeeded; repeating setup preserves locally generated secrets. Optional GPU downloads are skipped using the runtime's supported option; CPU package integrity and TLS verification were retained. Transformers.js CPU import succeeded.
- `npm run typecheck`, `npm run lint`, and `npm run build` passed.
- `npm test`: **18 passed, 0 failed, 0 skipped**. Includes ballots, malformed commands, replacement/clearing, stale ordering, deadlines, ties/zero votes, deletion rollback/tombstones, retention, restart persistence, OAuth state, CSRF, overlay boundaries, private drafts, merge/split lineage, owner-history binding, EventSub migration/recovery/revocation, refresh, and replay.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e`: **2 passed**. Demo evidence, keyboard composer, explicit vote/replacement, closed results after reload, separate overlay context, mutation rejection, mobile list, and reduced motion. Chromium 154 from the environment was used because the managed Playwright download was denied by network policy.
- `npm run test:production` passed: built frontend/asset serving, API health, authenticated mutations, graceful process shutdown, and closed-result recovery using the same temporary SQLite database after an actual `npm start` restart. See docs/PRODUCTION_SMOKE.json. External TLS termination was not exercised.
- `npm run test:load` passed with **700 synthetic messages**, 50/s for 6 seconds and 200/s for 2 seconds. Latest run: persistence p95 **0.410 ms**, maximum worker round trip **425 ms**, RSS **305 MiB**, and exactly seven ballots with counts `[7, 0, 7]`. Hardware and limits are recorded in docs/LOAD_RESULTS.json. This is not a Twitch, browser FPS, or long-duration throughput result.
- `npm run evaluate`: lexical pairwise precision/recall both 1.0 on **16 intentionally small Codex-authored synthetic examples**. This is not independent human evaluation or a general quality claim. Semantic comparison and independent stability evaluation are unrun; see docs/EVALUATION_RESULTS.json.
- Earlier checks caught and fixed SQLite placeholder counts, composer initial focus, StrictMode fragment bootstrap ordering, worker message/generation handling, and a nondeterministic analysis test that allowed background Demo ticks. Required tests now isolate synthetic timers and provider choice.

## External acceptance still pending

1. Twitch credentials are not configured. Current official documentation requests were denied (403); the supplied own-channel scope/subscription assumptions need current-source verification. Real authorization, received viewer chat, and the complete live walkthrough with consenting accounts remain unrun.
2. MiniLM model download was denied by the configured proxy policy. The runtime imports, but cached-model inference and license/runtime validation on downloaded artifacts remain pending. The app stays visibly in lexical fallback. No verification was disabled.
3. Actual OBS, external HTTPS hosting, Docker execution, longer load/frame-rate tests, and an independent human-labeled semantic/lexical evaluation remain unrun. Optional outgoing Twitch chat writes are not enabled; instructions can be copied manually.
4. Environment draft persistence is confirmed for install/start instructions, Twitch credential requirements, and additional Twitch/Hugging Face destinations. Saving did not apply or publish it. Review/save these changes in environment settings, then publish when appropriate. No fresh-task snapshot restoration is claimed.
5. No live video, external repository push, hosting deployment, hackathon submission, or session ID has been fabricated. The user obtains the main build-thread ID with `/status` and supplies actual acceptance footage.

## Codex contribution record

Codex authored the application, SQLite schema, worker/provider, voting rules, auth/EventSub plumbing, security boundaries, UI, automated tests, synthetic fixtures, measured reports, and operational documentation in this main thread. It diagnosed actual failures and recorded the passing reruns above. All bundled audience-like content is synthetic. User-supplied scope is preserved in SPEC.md.

## Real-footage acceptance clarification — 2026-11-01

- The user confirmed that the hackathon video must show the project actually running on Twitch and explain Codex use, within three minutes. Tightened docs/DEMO_SCRIPT.md so a synthetic-only or browser-preview take cannot be called submission-ready.
- Added docs/RECORDING_CHECKLIST.md with a three-account real-chat rehearsal, explicit expected replacement-ballot counts, actual OBS/Twitch capture steps, and credential-safe recording guidance.
- Rechecked effective app configuration without printing values: local session/encryption secrets are present; Twitch client credentials are absent. SQLite reports zero authorized connections and zero received Live messages. The active cloud policy still lacks the saved Twitch additions. These remain genuine external prerequisites.
- A tracked-source-only ZIP is prepared outside the checkout for running on the OBS computer; it excludes local secrets, databases, model caches, and dependencies. No live acceptance or footage has been claimed.

## Railway deployment preparation — 2026-11-01

- Switched hosting target to Railway at the user's request. Added railway.json (Dockerfile builder, health path, restart/drain configuration), docs/RAILWAY_SETUP.md, and a Windows clipboard-only secret generator. No Railway account, billing action, service, or domain has been provisioned by Codex.
- Confirmed current Railway behavior from the official railwayapp/docs GitHub source: Docker builds, injected PORT, generated public domains, root-owned volumes, one active deployment per attached volume, and brief volume-related redeploy downtime. The direct documentation host was denied by the cloud network policy; official source was accessible through GitHub.
- APP_ORIGIN now defaults to HTTPS plus RAILWAY_PUBLIC_DOMAIN when no explicit origin is configured. The production process/restart test exercises that fallback and passed. All 18 server tests, lint, and type checks passed after the change.
- Container startup initializes the mounted /data directory as root, then execs Node as UID 1000. The first runtime test found that private source-directory permissions prevented the node user reading /app/package.json; corrected COPY ownership and /app traversal permissions. Runtime verification is recorded separately in docs/RAILWAY_CONTAINER_SMOKE.json when successful.
- The image build exposed production dependency advisories. Upgraded @fastify/static from 8.x to compatible patched 10.1.8, resolving the high-severity direct advisories; production serving and restart tests pass. npm audit still reports three moderate findings in the static plugin's glob/minimatch chain (including the parent aggregate). No forced downgrade or unverified transitive-major override was applied. Directory listing is not enabled; remaining dependency maintenance is recorded rather than claiming a clean audit.
- Docker builds keep TLS and package integrity verification enabled. An optional BuildKit CA secret supports the managed cloud proxy without placing that session certificate in image layers. Runtime secrets and databases are excluded from the build context, including nested copies.

- Final local container smoke passed: mounted volume, application process UID 1000, generated-domain origin fallback, injected PORT 8080, frontend/API serving, authenticated voting, and closed-result/cookie recovery across container restart. Confirmed the image excludes local .env, .data, and model cache. See docs/RAILWAY_CONTAINER_SMOKE.json. Temporary test containers, volumes, and generated test secrets were removed. Actual Railway provisioning and external live acceptance remain pending.

## Empty-workspace snapshot repair — 2026-11-01

- The user supplied real hosted request logs: OAuth redirects completed, but authenticated `/api/snapshot` returned 409; the frontend then attempted Demo bootstrap and showed a misleading authorization error.
- Reproduced the server bug with a fresh in-memory database: `Cannot read properties of null (reading 'paused')`. Comparing `p?.sessionId === session?.id` incorrectly succeeded when both were absent. Added explicit playback and session existence guards.
- The API client now preserves HTTP status and attempts anonymous Demo bootstrap only after a 401, rather than masking arbitrary snapshot/server failures. Authorized owners without an active session see Ready and can explicitly start Live; no automatic Demo session is created for them.
- Added API regressions for brand-new workspaces and an authorized owner with no current session, including after ending a session. Browser regressions verify server errors are preserved and authorized empty workspaces render Ready without bootstrap or automatic Demo.
- Validation: 20 server tests and 4 browser tests passed; lint, types, and production build passed. The production smoke test now also checks the authenticated empty-database snapshot before creating a session. No secret changes, reauthorization, or data deletion are required by the code fix. The hosted Railway rollout itself still requires verification after redeploy.
