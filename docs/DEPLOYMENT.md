# Persistent deployment

Local operation is the default. Use a persistent Node 24 host, one replica, HTTPS reverse proxy with WebSocket upgrade support, and a writable SQLite/model-cache volume. The container listens on 3001. Do not deploy the connection worker to request-only serverless functions.

Build: `docker build -t chatlas .` after supplying normal registry access. Configure `.env` using `.env.example`; generate local keys with `npm run secrets:init`; set a real HTTPS `APP_ORIGIN`. Start using `docker compose up -d --build`. Keep the same encryption key across restarts. An unrelated key cannot decrypt existing Twitch tokens.

Docker uses the CPU runtime included in the npm package and skips optional GPU downloads. It does not fetch model weights during image build. To enable semantic analysis, install the model cache on the persistent volume with the same `EMBEDDING_MODEL` and `MODEL_CACHE_DIR`; permit the actual Hugging Face/redirect hosts without disabling TLS or checksum verification.

Forward HTTPS to port 3001 and preserve Origin and WebSocket upgrade headers. Health: `GET /api/health` reports the current API/database capability, not a real Twitch connection. Give the process graceful shutdown time. No container build or external deployment has been executed in this build environment; these are deployable assets pending host validation.

Backups: stop the single instance and copy the entire `/data` volume, including SQLite WAL/SHM if present, or use SQLite's online backup facility from a trusted administrator tool. Securely back up the encryption key separately. Never copy a live SQLite main file alone and assume a complete backup. Test restore into an isolated instance with the same key and verify closed results. Restrict backup access; it contains participant identifiers and vote revisions.

Public release prerequisites: bind/authorize the intended owner privately before exposing the installation; verify Twitch scope requirements and live acceptance; review privacy/retention; test model/runtime compatibility and real OBS on the target machine. The anonymous Demo bootstrap is for local synthetic use and is disabled permanently after owner binding. A different broadcaster requires a separate installation; there is no silent owner-switch feature.
