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

const IG_FIELDS = [
  "messages",
  "messaging_postbacks",
  "messaging_referrals",
  "message_reactions",
  "messaging_handovers",
  "message_reads",
].join(",");

async function run() {
  const pagesRes = await fetch(`${BASE}/me/accounts?fields=id,name,access_token,instagram_business_account&limit=100&access_token=${TOKEN}`);
  const pages = (await pagesRes.json()).data || [];

  console.log(`Encontradas ${pages.length} pages. Subscribing...\n`);

  for (const p of pages) {
    console.log(`--- ${p.name} (${p.id}) ---`);
    if (!p.access_token) { console.log("sem page token, skip"); continue; }

    // POST subscribed_apps com fields
    const url = `${BASE}/${p.id}/subscribed_apps`;
    const body = new URLSearchParams({
      subscribed_fields: IG_FIELDS,
      access_token: p.access_token,
    });
    const r = await fetch(url, { method: "POST", body });
    const j = await r.json();
    console.log("subscribe result:", JSON.stringify(j));

    // Verifica estado
    const check = await fetch(`${BASE}/${p.id}/subscribed_apps?access_token=${p.access_token}`);
    const cj = await check.json();
    console.log("state:", JSON.stringify(cj));
    console.log();
  }
}

run().catch(e => { console.error(e); process.exit(1); });
