import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { neon } from "@neondatabase/serverless";

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

const FORWARD_TOKEN = process.env.SYNC_API_TOKEN || process.env.AUTH_SECRET;
const URL = "https://crm.casaldotrafego.com/api/webhooks/meta-messaging/router";
const sql = neon(process.env.DATABASE_URL_CLIENTS);

async function post(label, payload) {
  const r = await fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forward-token": FORWARD_TOKEN,
    },
    body: JSON.stringify(payload),
  });
  const text = await r.text();
  console.log(`\n[${label}] HTTP ${r.status}: ${text}`);
}

async function run() {
  console.log("=== TEST 1: Messenger COM referral (deve criar lead) ===");
  await post("messenger-with-ad", {
    object: "page",
    entry: [{
      id: "167295509801065", // Gramado Plazza Page ID
      time: Math.floor(Date.now() / 1000),
      messaging: [{
        sender: { id: "test_psid_e2e_001" },
        recipient: { id: "167295509801065" },
        timestamp: Date.now(),
        message: { mid: "mid.e2e_001", text: "Oi, vi o anúncio de vocês!" },
        referral: { source: "ADS", type: "OPEN_THREAD", ad_id: "120200000000001", ref: "test_campaign_001" },
      }],
    }],
  });

  console.log("\n=== TEST 2: Messenger SEM referral (deve ser IGNORADO) ===");
  await post("messenger-organic", {
    object: "page",
    entry: [{
      id: "167295509801065",
      time: Math.floor(Date.now() / 1000),
      messaging: [{
        sender: { id: "test_psid_e2e_organic" },
        recipient: { id: "167295509801065" },
        timestamp: Date.now(),
        message: { mid: "mid.organic_001", text: "Boa tarde, quero info" },
      }],
    }],
  });

  console.log("\n=== TEST 3: IG Direct COM referral (deve criar lead) ===");
  await post("ig-with-ad", {
    object: "instagram",
    entry: [{
      id: "17841463047110872",
      time: Math.floor(Date.now() / 1000),
      messaging: [{
        sender: { id: "test_ig_sender_001" },
        recipient: { id: "17841463047110872" },
        timestamp: Date.now(),
        message: { mid: "mid.ig_001", text: "Oi, vim pelo anúncio" },
        referral: { source: "ADS", type: "OPEN_THREAD", ad_id: "120200000000002", ref: "test_ig_campaign" },
      }],
    }],
  });

  console.log("\n=== Aguardando 2s para DB propagar... ===");
  await new Promise(r => setTimeout(r, 2000));

  console.log("\n=== Leads no Gramado criados no último minuto ===");
  const recent = await sql`
    select name, whatsapp, campaign_source, utm_campaign, notes, created_at
    from leads
    where organization_id = '95ef9247-f3c6-4482-9c1c-73b955d0306d'
      and created_at > now() - interval '2 minutes'
    order by created_at desc
  `;
  console.log(JSON.stringify(recent, null, 2));
}

run().catch(e => { console.error(e); process.exit(1); });
