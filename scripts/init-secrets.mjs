import dotenv from "dotenv";
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync } from "node:fs";
dotenv.config({ quiet: true });
const additions = [];
for (const name of ["SESSION_SECRET", "TOKEN_ENCRYPTION_KEY"])
  if (!process.env[name])
    additions.push(name + "=" + randomBytes(32).toString("hex"));
if (additions.length) {
  const created = !existsSync(".env");
  appendFileSync(".env", "\n" + additions.join("\n") + "\n", { mode: 0o600 });
  console.log(
    `Generated ${additions.length} local secrets in ignored .env${created ? " (mode 0600)" : ""}. Values were not printed.`,
  );
} else console.log("Existing local secret bindings preserved.");
