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

const clientsUrl = process.env.DATABASE_URL_CLIENTS || process.env.DATABASE_URL;
const adminUrl = process.env.DATABASE_URL_SUPERADMIN || process.env.DATABASE_URL;

const clientsDb = neon(clientsUrl);
const adminDb = neon(adminUrl);

async function dump() {
  console.log("=== ORGS (clients DB) ===");
  const orgsC = await clientsDb`select id, slug, name, created_at from organizations order by created_at desc limit 50`;
  console.log(JSON.stringify(orgsC, null, 2));

  console.log("\n=== ORGS (admin DB) ===");
  try {
    const orgsA = await adminDb`select id, slug, name, created_at from organizations order by created_at desc limit 50`;
    console.log(JSON.stringify(orgsA, null, 2));
  } catch (e) {
    console.log("admin db error:", e.message);
  }

  console.log("\n=== META INTEGRATIONS (clients DB) ===");
  const ints = await clientsDb`select * from meta_integrations order by created_at desc limit 50`;
  console.log(JSON.stringify(ints, null, 2));

  console.log("\n=== LEAD COUNTS por org (últimos 30d) ===");
  const stats = await clientsDb`
    select o.slug, o.name, count(l.id) as leads_30d,
           count(case when l.campaign_source = 'WhatsApp' then 1 end) as wa,
           count(case when l.campaign_source = 'Direct' then 1 end) as ig
    from organizations o
    left join leads l on l.organization_id = o.id and l.created_at > now() - interval '30 days'
    group by o.id, o.slug, o.name
    order by leads_30d desc
  `;
  console.log(JSON.stringify(stats, null, 2));

  console.log("\n=== LAST 20 LEADS (qualquer org) ===");
  const lastLeads = await clientsDb`
    select l.id, l.name, l.whatsapp, l.campaign_source, l.utm_source, l.created_at, o.slug
    from leads l
    join organizations o on o.id = l.organization_id
    order by l.created_at desc limit 20
  `;
  console.log(JSON.stringify(lastLeads, null, 2));
}

dump().catch(e => { console.error(e); process.exit(1); });
