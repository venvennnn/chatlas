# Twitch registration and acceptance

## Register

1. Enable verification and two-factor authentication on the broadcaster's Twitch account as required by Twitch.
2. Open the Twitch developer console and register a uniquely available application name, for example **Chatlas by Venmani**. Choose **Website Integration**, **Confidential** client type: only the backend stores the client secret.
3. Register **exactly** `APP_ORIGIN` plus `/auth/twitch/callback`. The default development candidate is `http://localhost:5173/auth/twitch/callback`. Use it only if Twitch accepts that localhost exception. Otherwise use trusted local HTTPS or an HTTPS tunnel to Vite. Set `APP_ORIGIN` to that exact HTTPS origin and open the dashboard there. Production always uses HTTPS.
4. Put `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` in secure environment settings or ignored local `.env`. Never paste them into chat, screenshots, source code, or frontend configuration. Run `npm run secrets:init` for the locally generated session/encryption secrets. Do not use a proxy placeholder as an AES key.
5. Restart the server. In Settings, choose **Connect Twitch**. Authorize the broadcaster's own account. Chatlas uses the authorization-code flow, an expiring browser-bound single-use state, server-side exchange, identity validation, and HttpOnly cookies.

## Implemented scopes and routes

- `/auth/twitch/start`, `/auth/twitch/callback`, `POST /api/auth/disconnect`.
- `user:read:chat` is requested for EventSub chat reading, targeting `broadcaster_user_id` and `user_id` equal to the authorized broadcaster's ID.
- Subscriptions are created with the user access token through `POST https://api.twitch.tv/helix/eventsub/subscriptions`, after a welcome from `wss://eventsub.wss.twitch.tv/ws`.
- Version 1 topics: `channel.chat.message`, `channel.chat.message_delete`, `channel.chat.clear_user_messages`, `channel.chat.clear`.
- `user:write:chat` and native polls are **not** requested. Optional outgoing instructions/results are not implemented; manually paste the displayed instructions into chat.
- After authorization, choose **Start live ingestion**. Subscribing is distinct from Live. Chatlas shows **live only after receiving an actual chat notification**.

The exact scope/subscription combination follows the own-channel design in the supplied brief. Official pages were blocked by the build environment, so current-source verification remains a required manual check before Live acceptance:

- https://dev.twitch.tv/docs/chat/authenticating/
- https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/
- https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/
- https://dev.twitch.tv/docs/authentication/validate-tokens/
- https://dev.twitch.tv/docs/authentication/refresh-tokens/
- https://dev.twitch.tv/docs/eventsub/handling-websocket-events/

## Recovery and security

Tokens are AES-256-GCM encrypted in SQLite. Validation runs on startup and hourly. Refresh is single-flight and persists rotated refresh tokens. Invalid identities invalidate dashboard/overlay credentials. The first authorized broadcaster is bound to the installation; later authorization must match that identity. Disconnect ends ingestion/session, removes tokens, and invalidates dashboard and overlay access. Retained session data remains private; Demo bootstrap is disabled after owner binding. Reauthorize the same owner to access retained history.

Keepalive timeouts trigger ordinary reconnects with new subscriptions. Twitch-directed reconnects migrate before closing the old socket. Delivery IDs and per-session Twitch message IDs deduplicate events. Ordinary disconnects leave an ingestion-gap marker; events missed during a gap are not replayed. Shared-origin events from other broadcasters are excluded. Revocation requires authorization again.

## Troubleshooting

- **Redirect mismatch:** compare scheme, hostname, port, and callback path in the console, `APP_ORIGIN`, and browser address. Avoid mixing localhost and 127.0.0.1. Restart after changes.
- **Missing scopes / 401 / 403 subscription:** verify current official requirements, reauthorize the owner, and confirm the app client ID matches token validation. Never invent successful subscriptions.
- **Authorization expired:** reconnect the same owner through OAuth. Do not manually replace encrypted database token fields.
- **Empty chat:** check that the session is Live source, transport is subscribing/live, and actual messages are being sent by consenting participants in the owner's channel. No fabricated fill is added to Live.
- **Network:** allow HTTPS `dev.twitch.tv`, `id.twitch.tv`, `api.twitch.tv` and WebSocket `eventsub.wss.twitch.tv`. Model downloads also require Hugging Face destinations/redirect hosts. In this cloud environment these additions were saved in the configuration draft; review/save and publish through environment settings before relying on them.

## Required manual acceptance (not yet executed)

Connect the real owner, receive actual viewer messages, inspect a visible topic, publish a 2–5 option vote, replace one account's ballot, close accurately, refresh/restart and verify the closed result, then display the result in actual OBS. Use consenting real accounts and record actual outcomes in BUILD_LOG.md. Never relabel Demo or Replay footage as Live.
