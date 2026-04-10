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

const TOKEN = process.env.META_ACCESS_TOKEN;
const BASE = "https://graph.facebook.com/v21.0";

async function run() {
  const pagesRes = await fetch(`${BASE}/me/accounts?fields=id,name,access_token,instagram_business_account&limit=100&access_token=${TOKEN}`);
  const pages = (await pagesRes.json()).data || [];
  const gramado = pages.find(p => p.name.toLowerCase().includes("gramado"));
  const pageToken = gramado.access_token;

  console.log("=== Primeira conversa da Page Gramado (participants + msgs) ===");
  const convRes = await fetch(`${BASE}/${gramado.id}/conversations?fields=participants,messages.limit(3){id,from,to,message,created_time},updated_time&limit=5&access_token=${pageToken}`);
  const conv = await convRes.json();
  console.log(JSON.stringify(conv, null, 2));

  console.log("\n=== /me/conversations com platform=instagram (tenta via user token) ===");
  const r = await fetch(`${BASE}/me/conversations?platform=instagram&access_token=${pageToken}&limit=5`);
  console.log(JSON.stringify(await r.json(), null, 2));
}

run().catch(e => { console.error(e); process.exit(1); });
