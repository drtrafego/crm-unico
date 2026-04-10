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
const V = "v21.0";
const BASE = `https://graph.facebook.com/${V}`;

async function gql(path) {
  const url = `${BASE}/${path}${path.includes("?") ? "&" : "?"}access_token=${TOKEN}`;
  const r = await fetch(url);
  const j = await r.json();
  return { ok: r.ok, status: r.status, data: j };
}

async function run() {
  console.log("=== 1. DEBUG TOKEN (ver app_id + scopes + user_id) ===");
  const dbg = await gql(`debug_token?input_token=${TOKEN}`);
  console.log(JSON.stringify(dbg, null, 2));
  const appId = dbg.data?.data?.app_id;
  const userId = dbg.data?.data?.user_id;
  const scopes = dbg.data?.data?.scopes || [];
  console.log(`\nAPP_ID detectado: ${appId}`);
  console.log(`USER_ID: ${userId}`);
  console.log(`SCOPES: ${scopes.join(", ")}`);

  console.log("\n=== 2. ME (identidade do token) ===");
  const me = await gql("me?fields=id,name");
  console.log(JSON.stringify(me, null, 2));

  console.log("\n=== 3. APP SUBSCRIPTIONS (webhook fields por object) ===");
  if (appId) {
    const subs = await gql(`${appId}/subscriptions`);
    console.log(JSON.stringify(subs, null, 2));
  }

  console.log("\n=== 4. PAGES que o token gerencia ===");
  const pages = await gql("me/accounts?fields=id,name,instagram_business_account,access_token,tasks&limit=100");
  console.log(JSON.stringify(pages.data?.data?.map(p => ({
    id: p.id,
    name: p.name,
    tasks: p.tasks,
    instagram_business_account: p.instagram_business_account,
    has_page_token: !!p.access_token,
  })) || pages, null, 2));

  console.log("\n=== 5. IG BUSINESS ACCOUNT Gramado Plaza (17841463047110872) ===");
  const ig = await gql("17841463047110872?fields=id,username,name,followers_count,profile_picture_url");
  console.log(JSON.stringify(ig, null, 2));

  console.log("\n=== 6. IG conversations (DMs) Gramado Plaza ===");
  const conv = await gql("17841463047110872/conversations?platform=instagram&fields=id,updated_time,participants,messages.limit(1){id,message,from,created_time}&limit=10");
  console.log(JSON.stringify(conv, null, 2));

  console.log("\n=== 7. Subscribed apps por Page (checar se CRM está subscrito) ===");
  for (const p of pages.data?.data || []) {
    if (!p.access_token) continue;
    const u = `${BASE}/${p.id}/subscribed_apps?access_token=${p.access_token}`;
    const r = await fetch(u);
    const j = await r.json();
    console.log(`Page ${p.name} (${p.id}):`, JSON.stringify(j, null, 2));
  }
}

run().catch(e => { console.error(e); process.exit(1); });
