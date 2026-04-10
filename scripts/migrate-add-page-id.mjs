import { neon } from "@neondatabase/serverless";
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

const sql = neon(process.env.DATABASE_URL_CLIENTS);
const TOKEN = process.env.META_ACCESS_TOKEN;
const BASE = "https://graph.facebook.com/v21.0";

// mapeamento manual org_slug → nome aproximado da Page
const pageNameMap = {
  "gramado-plaza": "gramado",
  "pontucar": "pontucar",
  "emporio-gusto-reale": "paulistinha", // ⚠ verificar
  "dona-domestica-mar26": "donna domestica",
  "agente24horas": "amanda felix",
  "admin": "drtrafeg",
};

async function run() {
  console.log("=== 1. ADD COLUMN facebook_page_id ===");
  await sql`ALTER TABLE meta_integrations ADD COLUMN IF NOT EXISTS facebook_page_id text`;
  console.log("OK\n");

  console.log("=== 2. Buscar Pages via Graph ===");
  const r = await fetch(`${BASE}/me/accounts?fields=id,name,instagram_business_account&limit=100&access_token=${TOKEN}`);
  const pages = (await r.json()).data || [];
  for (const p of pages) console.log(`  ${p.name} → page_id=${p.id} ig_id=${p.instagram_business_account?.id || "-"}`);

  console.log("\n=== 3. Auto-match por ig_account_id (mais confiável) ===");
  const ints = await sql`select id, organization_id, ig_account_id, account_name from meta_integrations where ig_account_id is not null`;

  for (const i of ints) {
    const page = pages.find(p => p.instagram_business_account?.id === i.ig_account_id);
    if (page) {
      await sql`update meta_integrations set facebook_page_id = ${page.id}, updated_at = now() where id = ${i.id}`;
      console.log(`  ✓ ${i.account_name} (${i.ig_account_id}) → page ${page.name} (${page.id})`);
    } else {
      console.log(`  ✗ ${i.account_name} (${i.ig_account_id}) — sem Page com esse IG vinculado`);
    }
  }

  console.log("\n=== 4. Checar resultado ===");
  const after = await sql`select account_name, ig_account_id, facebook_page_id, whatsapp_type from meta_integrations order by created_at desc`;
  console.log(JSON.stringify(after, null, 2));
}

run().catch(e => { console.error(e); process.exit(1); });
