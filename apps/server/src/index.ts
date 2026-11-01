import { createApp } from "./app.ts";
import { config } from "./config.ts";
const { app } = await createApp();
await app.listen({ port: config.PORT, host: "0.0.0.0" });
console.log(
  `Chatlas server listening on port ${config.PORT}. Demo is synthetic; live requires Twitch authorization.`,
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
