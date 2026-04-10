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
const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN;
const BASE = "https://graph.facebook.com/v21.0";
const CALLBACK_URL = "https://crm.casaldotrafego.com/api/webhooks/meta-messaging/router";
const appToken = `${APP_ID}|${APP_SECRET}`;

async function tryFields(label, fields) {
  const params = new URLSearchParams({
    object: "instagram",
    callback_url: CALLBACK_URL,
    fields: fields.join(","),
    verify_token: VERIFY_TOKEN,
    access_token: appToken,
  });
  const r = await fetch(`${BASE}/${APP_ID}/subscriptions`, { method: "POST", body: params });
  const j = await r.json();
  console.log(`[${label}] fields=[${fields.join(",")}]`);
  console.log(`  ${r.status}:`, JSON.stringify(j));
  return r.ok;
}

async function run() {
  // Tenta subsets progressivos de fields IG
  await tryFields("only-messages", ["messages"]);
  await tryFields("only-mentions", ["mentions"]);
  await tryFields("only-comments", ["comments"]);
  await tryFields("messaging_referrals", ["messaging_referrals"]);
  await tryFields("messaging_postbacks", ["messaging_postbacks"]);
  await tryFields("message_reactions", ["message_reactions"]);
  await tryFields("story_insights", ["story_insights"]);
  await tryFields("standby", ["standby"]);

  console.log("\n=== Estado final ===");
  const r = await fetch(`${BASE}/${APP_ID}/subscriptions?access_token=${appToken}`);
  const subs = (await r.json()).data || [];
  for (const s of subs) {
    console.log(`  ${s.object} → ${s.callback_url}`);
    console.log(`    fields: ${s.fields.map(f => f.name).join(", ")}`);
  }
}

run().catch(e => { console.error(e); process.exit(1); });
