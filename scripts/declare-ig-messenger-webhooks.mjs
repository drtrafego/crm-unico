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

if (!APP_SECRET || !VERIFY_TOKEN) {
  console.error("❌ META_APP_SECRET ou META_WEBHOOK_VERIFY_TOKEN ausentes");
  process.exit(1);
}

const appToken = `${APP_ID}|${APP_SECRET}`;

async function declare(object, fields) {
  const params = new URLSearchParams({
    object,
    callback_url: CALLBACK_URL,
    fields: fields.join(","),
    verify_token: VERIFY_TOKEN,
    access_token: appToken,
  });
  const url = `${BASE}/${APP_ID}/subscriptions`;
  const r = await fetch(url, { method: "POST", body: params });
  const j = await r.json();
  return { ok: r.ok, status: r.status, data: j };
}

async function listSubs() {
  const r = await fetch(`${BASE}/${APP_ID}/subscriptions?access_token=${appToken}`);
  return (await r.json()).data || [];
}

async function run() {
  console.log("=== ANTES ===");
  const before = await listSubs();
  for (const s of before) {
    console.log(`  ${s.object} → ${s.callback_url} (active=${s.active})`);
    console.log(`    fields: ${s.fields.map(f => f.name).join(", ")}`);
  }

  console.log("\n=== 1. Declarar object 'instagram' ===");
  const igFields = ["messages", "messaging_postbacks", "messaging_referrals", "message_reactions"];
  const ig = await declare("instagram", igFields);
  console.log(`STATUS ${ig.status}:`, JSON.stringify(ig.data, null, 2));

  console.log("\n=== 2. Declarar object 'page' (Messenger) ===");
  const pageFields = ["messages", "messaging_postbacks", "messaging_referrals", "message_reactions", "messaging_handovers", "message_reads"];
  const page = await declare("page", pageFields);
  console.log(`STATUS ${page.status}:`, JSON.stringify(page.data, null, 2));

  console.log("\n=== DEPOIS ===");
  const after = await listSubs();
  for (const s of after) {
    console.log(`  ${s.object} → ${s.callback_url} (active=${s.active})`);
    console.log(`    fields: ${s.fields.map(f => f.name).join(", ")}`);
  }
}

run().catch(e => { console.error(e); process.exit(1); });
