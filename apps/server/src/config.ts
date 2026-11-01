import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
export const projectRoot = fileURLToPath(new URL("../../../", import.meta.url));
dotenv.config({ path: resolve(projectRoot, ".env"), quiet: true });
import { z } from "zod";
const schema = z.object({
  APP_ORIGIN: z.url().default("http://localhost:5173"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_PATH: z.string().default(".data/chatlas.sqlite"),
  TWITCH_CLIENT_ID: z.string().optional(),
  TWITCH_CLIENT_SECRET: z.string().optional(),
  SESSION_SECRET: z.string().min(32).optional(),
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .regex(/^[a-fA-F0-9]{64}$/, "must be 64 hexadecimal characters")
    .optional(),
  EMBEDDING_MODEL: z.string().default("Xenova/all-MiniLM-L6-v2"),
  MODEL_CACHE_DIR: z.string().default(".model-cache"),
});
const runtimeVariables = Object.fromEntries(
  Object.entries(process.env).map(([k, v]) => [k, v === "" ? undefined : v]),
);
if (!runtimeVariables.APP_ORIGIN && process.env.RAILWAY_PUBLIC_DOMAIN) {
  runtimeVariables.APP_ORIGIN = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
}
const parsed = schema.safeParse(runtimeVariables);
if (!parsed.success)
  throw new Error(
    "Invalid configuration: " +
      parsed.error.issues
        .map((i) => i.path.join(".") + " " + i.message)
        .join("; "),
  );
export const config = {
  ...parsed.data,
  DATABASE_PATH: resolve(projectRoot, parsed.data.DATABASE_PATH),
};
export const twitchConfigured = Boolean(
  config.TWITCH_CLIENT_ID &&
  config.TWITCH_CLIENT_SECRET &&
  config.SESSION_SECRET &&
  config.TOKEN_ENCRYPTION_KEY,
);
if (
  process.env.NODE_ENV === "production" &&
  (!config.SESSION_SECRET ||
    !config.TOKEN_ENCRYPTION_KEY ||
    !config.APP_ORIGIN.startsWith("https://"))
)
  throw new Error(
    "Production requires HTTPS APP_ORIGIN, SESSION_SECRET and TOKEN_ENCRYPTION_KEY",
  );
