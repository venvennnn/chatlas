# Real Twitch rehearsal and recording checklist

Status at preparation: **not executed**. The build environment has no configured Twitch client credentials, authorized connection, or received Live messages. No actual OBS/Twitch footage exists in this repository. Automated Demo and simulated transport tests do not establish this acceptance.

## Prepare the machine running OBS

Use the source bundle supplied with this build, or your own checkout after publishing the local commit to your repository. The initial GitHub repository was empty; the implementation commit is local, so do not assume a fresh clone already contains it.

1. Install Node 24 and follow README.md to install from the lockfile, preserve/create `.env`, run `npm run secrets:init`, and start `npm run dev`. Use `ONNXRUNTIME_NODE_INSTALL=skip` as documented for the bundled CPU runtime.
2. Register the Confidential Twitch app using TWITCH_SETUP.md. Set `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` securely in local `.env` or environment settings. Never paste secret values into the Codex conversation. Match `APP_ORIGIN` and the registered `/auth/twitch/callback` URL exactly; restart after configuration changes.
3. If running in this managed cloud environment, apply the saved Twitch network requirements and configure a real reachable application origin. OBS on your computer cannot use the cloud machine's localhost. Running Chatlas on the OBS computer avoids that host mismatch. Local HTTP OAuth is usable only if Twitch accepts its localhost exception; otherwise use trusted HTTPS.
4. Recheck current official Twitch scope requirements before authorization. This build requests `user:read:chat` for its broadcaster-own-channel EventSub subscriptions. Optional outgoing writes are disabled; paste voting instructions manually.
5. Keep desktop capture away from `.env`, developer-console secrets, browser storage, OAuth responses, and the full private overlay link. Capture the finished OBS canvas instead of its source-configuration dialog.

## Rehearse the complete interaction

- [ ] Connect the broadcaster through Settings → Connect Twitch. The owner completes OAuth in their browser.
- [ ] Choose Start live ingestion. Confirm source **LIVE**; wait for actual received events before treating transport status as live. No Demo burst should appear in this session.
- [ ] In OBS, add a Browser Source using the generated private link at 1920 × 1080. Check transparency, readability, and scene placement using OBS_SETUP.md.
- [ ] Start your Twitch stream and confirm the actual overlay appears in the stream output. Obtain consent from the friends participating in the recording.
- [ ] Three distinct accounts send messages about the same subject, for example “Minecraft survival next?”, “I'd watch Minecraft”, and “Not Minecraft again, please.” Wait for a neutral topic and inspect the underlying received evidence. Keep the provider label honest: lexical fallback is usable for this rehearsal and must not be described as semantic-model inference.
- [ ] Have one account repeat its message. Observe message volume versus distinct contributors; do not claim the topic speaks for all viewers.
- [ ] Create a fresh decision with options **1 Minecraft**, **2 Valorant**, **3 Stardew Valley**. Choose **120 seconds** so participants have time, then publish. Display or paste `!vote 1 3` instructions.
- [ ] Account A sends `!vote 1 3`, B sends `!vote 2`, C sends `!vote 1`. For exactly these fresh ballots, expected counts are **[2, 1, 1]**, with **3 voters**.
- [ ] Account A sends `!vote 2` to replace its entire ballot. Expected counts become **[1, 2, 0]**, with **3 voters**. Repeating A's command must preserve those counts. These are expected values for the specified inputs, not recorded results.
- [ ] Close the vote manually. Verify the observed counts, denominator, and winner/tie. Show the Results layout in actual OBS and on the Twitch stream. If any discrepancy occurs, preserve the evidence and diagnose it before recording a final take.
- [ ] Refresh the OBS Browser Source and confirm the current closed result returns. Optionally restart Chatlas and verify the closed result survives. A disconnected overlay must not imply voting remains open.
- [ ] Record actual Codex build-thread footage, code, and executed test results. Obtain the real main thread session ID using `/status`.

## Export and submission gate

Follow DEMO_SCRIPT.md for the 165-second cut. Check the exported duration, not just the editing timeline. Show actual Twitch and OBS footage plus Codex use. Clearly labeled synthetic bursts may supplement the footage, but must never replace the real interaction.

Record actual outcomes and any defects in BUILD_LOG.md. Mark this checklist complete only after observing the steps above. Upload a real video, supply its actual URL, and verify the organizer's Submitted status yourself. No submission, video, or acceptance result is fabricated by this checklist.
