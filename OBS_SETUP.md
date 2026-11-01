# OBS Browser Source

1. Keep Chatlas running on a persistent host. In Settings → OBS overlay choose **Create link**.
2. Choose **Compact Pulse**, **Expanded Atlas**, **Voting**, or **Results**. Preview on both light and dark backdrops. Aggregate labels are the default; verbatim messages/usernames require an explicit setting. Dashboard evidence remains private.
3. Copy the generated browser-source URL. Its random credential is in the fragment after `#`. Treat the complete link as private. Never include it in a screenshot, repository, video, or logs.
4. Add a Browser Source in OBS: width **1920**, height **1080**, URL equal to the copied link. The page background is transparent and the compact panel leaves most of the canvas clear. Use OBS transforms to place or scale it; the default panel is at the upper left with a 40px inset.
5. Enable refresh when the scene becomes active if desired. Refresh restores the current snapshot without replaying result celebrations. For continuous state, leave the source loaded when hidden.
6. Verify readability against your actual footage. Use **Pause public overlay** before discussing sensitive topics. Hide or rename topics privately before publication. Only constrained safe labels or owner-approved labels are published.

The fragment is removed from browser history after same-origin bootstrap. Only its hash is persisted. The resulting cookie and WebSocket session are read-only and separate from dashboard authorization. Rotating the link invalidates existing overlay sessions; update OBS with the new full URL. Disconnecting Twitch invalidates all overlay credentials.

A broken link shows an unavailable message. A lost WebSocket shows **STALE · reconnecting** and withholds open-vote instructions. A paused panel says Overlay paused. Closed decisions survive server restarts. OBS itself has **not** been exercised in this build; browser-source rendering and mutation restrictions have Playwright coverage.

For connection problems, verify server health, exact origin, correct layout query before the `#`, and a current credential. `localhost` inside OBS refers to the OBS computer; use an HTTPS host reachable from that machine when Chatlas runs elsewhere. Do not expose a local Demo server publicly as a production deployment.
