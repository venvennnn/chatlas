# Deploy Chatlas on Railway

Deploy the whole application as **one persistent Docker web service**. `railway.json` selects the root Dockerfile, health path, and restart policy. Railway supplies HTTPS and the listening port. A persistent volume is required for SQLite; this is a usage-billed service, not a guaranteed free deployment. Check the current plan/estimate before starting it.

## 1. Connect the repository

In Railway choose **New Project → Deploy from GitHub repo → venvennnn/chatlas** and select branch `main`. Grant Railway access to that repo if prompted. Use the repository root; leave custom build/start commands empty so the Dockerfile and its entrypoint apply. No Railway token is needed in Chatlas or this chat.

The first automatic deployment can fail until you configure the required variables and domain below. Complete configuration, then redeploy. An initial configuration failure is not evidence that the app is live.

## 2. Add persistent storage and variables

Attach a volume to this service at **`/data`**, using the available default size for your plan and monitoring storage usage. Keep **one replica** in one region and disable Serverless/app sleeping. SQLite and the ongoing Twitch connection need one continuously running instance. The container briefly initializes the root-owned mount, then runs Node as its unprivileged `node` user.

The Docker image already sets:

```dotenv
NODE_ENV=production
DATABASE_PATH=/data/chatlas.sqlite
MODEL_CACHE_DIR=/data/model-cache
```

Add these variables in Railway:

| Variable               | Value                                                                     |
| ---------------------- | ------------------------------------------------------------------------- |
| `SESSION_SECRET`       | A freshly generated secret of at least 32 characters                      |
| `TOKEN_ENCRYPTION_KEY` | A separately generated secret: exactly 64 hexadecimal characters          |
| `EMBEDDING_MODEL`      | `lexical` for the initial deployment; the UI clearly labels this fallback |

Generate the two secrets locally on Windows with `scripts/railway-secrets.ps1` in PowerShell. It copies both `NAME=value` lines to your clipboard for Railway's **Variables → Raw Editor**, without printing them. If you have not downloaded the repository, this equivalent PowerShell snippet works:

```powershell
function New-ChatlasSecret {
    $r = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $b = New-Object byte[] 32
        $r.GetBytes($b)
        ([BitConverter]::ToString($b)).Replace('-', '').ToLowerInvariant()
    } finally { $r.Dispose() }
}
Set-Clipboard "SESSION_SECRET=$(New-ChatlasSecret)`nTOKEN_ENCRYPTION_KEY=$(New-ChatlasSecret)"
```

Paste directly into Railway, not into chat. Preserve these values across redeployments; changing the encryption key prevents reading saved Twitch tokens. Do not run the generator again to fix unrelated deployment errors.

## 3. Generate the HTTPS domain

Service **Settings → Networking / Public Networking → Generate Domain**. Route to Railway's injected `PORT`, or the image's default **3001** when asked for a target port. Copy the resulting actual HTTPS URL.

Chatlas automatically derives its HTTPS application origin from Railway's `RAILWAY_PUBLIC_DOMAIN` when `APP_ORIGIN` is unset. If the variable is unavailable, or you use a custom domain, explicitly set `APP_ORIGIN` to the full HTTPS origin, without a trailing slash or callback path. Redeploy after domain/variable changes. A production deployment requires a domain and both generated secrets before becoming healthy.

Open the generated domain. Confirm `/api/health` returns `ok: true`, the dashboard opens in labeled Demo mode, a test vote works, and a closed result survives a service restart. Health means the app/database respond; it does not mean Twitch is authorized.

## 4. Finish Twitch registration

Use these registration values:

- Name: an available name such as **Chatlas by Venmani**.
- Category: **Website Integration**.
- Client type: **Confidential**.
- OAuth Redirect URL: your actual Railway HTTPS origin plus **`/auth/twitch/callback`**.

Add `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` in Railway Variables; keep the Client Secret private. Redeploy, open the same public domain, and choose **Settings → Connect Twitch**, followed by **Start live ingestion**. Recheck current Twitch scope requirements using TWITCH_SETUP.md. No separate frontend deployment or CORS service is needed.

Authorize the intended broadcaster promptly before sharing the public address. The first authorization binds the installation's owner; anonymous Demo bootstrap is disabled thereafter. If the owner must change, use a separate fresh installation rather than changing the stored binding manually.

## 5. OBS and recording

Create the overlay link in Chatlas Settings. In Windows OBS, add a 1920×1080 Browser Source using that private link. It uses the Railway origin and requires no ngrok or local Node server. Keep Railway running during the stream. Follow RECORDING_CHECKLIST.md for real viewer messages, actual votes, result persistence, and Twitch/OBS footage.

Model downloads are optional for the initial rehearsal. To enable semantic inference later, run `npm run model:download` in a Railway runtime shell with `/data/model-cache` mounted and the default model selected, then restart. Build-time model downloads cannot populate a runtime-only mounted volume. Keep the provider label truthful until an actual model inference succeeds.

## Troubleshooting

- **Production configuration error:** set both secrets and generate the HTTPS domain; use explicit `APP_ORIGIN` if automatic Railway domain injection is unavailable.
- **Health check failure:** ensure `PORT` is passed unchanged to Node, the health path is `/api/health`, the volume is mounted at `/data`, and custom start commands have not bypassed the image entrypoint. Inspect actual deploy logs.
- **Database disappears after redeploy:** the data path must be on the attached volume, with one replica. Keep backups and preserve the encryption key.
- **Origin rejected / redirect mismatch:** dashboard URL, `APP_ORIGIN` (if supplied), and Twitch callback must share the same exact origin. Redeploy after changes. Do not register a GitHub URL or placeholder.
- **Permission denied on `/data`:** use the current Dockerfile/entrypoint. It addresses Railway's documented root-owned volume behavior without running the application itself as root.
- **Short gap on redeploy:** Railway documents a downtime period for services with an attached volume. Chatlas records an ingestion gap; missed chat is not replayed.

Official Railway documentation was checked through its public `railwayapp/docs` GitHub source during preparation: Dockerfile builds, config-as-code, health checks, and volume limitations. External Railway provisioning, billing, domain creation, Twitch authorization, and OBS acceptance still require your Railway/Twitch accounts; no deployment URL or successful hosted state is invented here.
