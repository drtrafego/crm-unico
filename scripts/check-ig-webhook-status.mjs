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
const APP_SECRET = process.env.META_APP_SECRET;
const APP_ID = "917411172673844";
const BASE = "https://graph.facebook.com/v21.0";

async function gql(path, opts = {}) {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${BASE}/${path}${sep}access_token=${opts.token || TOKEN}`;
  const r = await fetch(url, opts.init);
  return { ok: r.ok, status: r.status, data: await r.json() };
}

async function run() {
  console.log("=== 1. Permissions concedidas no token ===");
  const perms = await gql("me/permissions");
  const ig = (perms.data?.data || []).filter(p => /instagram|page/.test(p.permission));
  console.log(JSON.stringify(ig, null, 2));

  console.log("\n=== 2. Tentando ler subscriptions do App (precisa app_secret) ===");
  if (APP_SECRET) {
    const appToken = `${APP_ID}|${APP_SECRET}`;
    const subs = await gql(`${APP_ID}/subscriptions`, { token: appToken });
    console.log("STATUS:", subs.status);
    console.log(JSON.stringify(subs.data, null, 2));
  } else {
    console.log("⚠ META_APP_SECRET não está no .env.local");
    console.log("Sem o secret eu não consigo:");
    console.log("  - Ler quais objects estão subscritos no App");
    console.log("  - Adicionar novo subscription via API");
    console.log("Solução: pegue o secret em developers.facebook.com → seu App → Settings → Basic → App Secret (Show)");
    console.log("E adicione no .env.local: META_APP_SECRET=xxxxx");
  }

  console.log("\n=== 3. Estado das Pages com IG vinculado (após subscribe-pages) ===");
  const pages = await gql("me/accounts?fields=id,name,access_token,instagram_business_account&limit=100");
  for (const p of pages.data?.data || []) {
    if (!p.instagram_business_account?.id) continue;
    const sa = await fetch(`${BASE}/${p.id}/subscribed_apps?access_token=${p.access_token}`);
    const j = await sa.json();
    const fields = j.data?.[0]?.subscribed_fields || [];
    console.log(`  ${p.name} (page ${p.id} → ig ${p.instagram_business_account.id})`);
    console.log(`    fields: [${fields.join(", ") || "VAZIO"}]`);
  }

  console.log("\n=== 4. App básico (sem secret) ===");
  const app = await gql(`${APP_ID}?fields=id,name,namespace,category,link`);
  console.log(JSON.stringify(app.data, null, 2));
}

run().catch(e => { console.error(e); process.exit(1); });
