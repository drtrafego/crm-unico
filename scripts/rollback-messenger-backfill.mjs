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

async function run() {
  const [org] = await sql`select id, name from organizations where slug = 'gramado-plaza'`;
  if (!org) { console.log("Org não encontrada"); return; }

  console.log("=== Leads que serão deletados (backfill Messenger) ===");
  const candidates = await sql`
    select id, name, whatsapp, notes, created_at
    from leads
    where organization_id = ${org.id}
      and campaign_source = 'Messenger'
      and whatsapp like 'fb:%'
    order by created_at desc
  `;
  console.log(`Total: ${candidates.length}`);
  for (const c of candidates.slice(0, 5)) {
    console.log(`  - ${c.name} (${c.whatsapp})`);
  }
  if (candidates.length > 5) console.log(`  ... e mais ${candidates.length - 5}`);

  console.log("\n=== Deletando ===");
  const result = await sql`
    delete from leads
    where organization_id = ${org.id}
      and campaign_source = 'Messenger'
      and whatsapp like 'fb:%'
    returning id
  `;
  console.log(`Deletados: ${result.length}`);
}

run().catch(e => { console.error(e); process.exit(1); });
