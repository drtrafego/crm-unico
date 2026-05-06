import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envText = readFileSync(resolve(__dirname, "..", ".env.local"), "utf-8");
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (!m) continue;
  let [, k, v] = m;
  v = v.replace(/^["']|["']$/g, "");
  if (!process.env[k]) process.env[k] = v;
}

const APP_ID = "917411172673844";
const APP_SECRET = process.env.META_APP_SECRET;
const BASE = "https://graph.facebook.com/v21.0";
const appToken = `${APP_ID}|${APP_SECRET}`;

const NEW_PRIVACY = "https://www.casaldotrafego.com/politicadeprivacidade";

async function run() {
  console.log("=== Antes ===");
  const before = await fetch(`${BASE}/${APP_ID}?fields=privacy_policy_url,terms_of_service_url&access_token=${appToken}`);
  console.log(JSON.stringify(await before.json(), null, 2));

  console.log("\n=== Atualizando privacy_policy_url ===");
  const params = new URLSearchParams({
    privacy_policy_url: NEW_PRIVACY,
    access_token: appToken,
  });
  const r = await fetch(`${BASE}/${APP_ID}`, { method: "POST", body: params });
  console.log(`HTTP ${r.status}:`, JSON.stringify(await r.json(), null, 2));

  console.log("\n=== Depois ===");
  const after = await fetch(`${BASE}/${APP_ID}?fields=privacy_policy_url,terms_of_service_url&access_token=${appToken}`);
  console.log(JSON.stringify(await after.json(), null, 2));
}

run().catch(e => { console.error(e); process.exit(1); });
