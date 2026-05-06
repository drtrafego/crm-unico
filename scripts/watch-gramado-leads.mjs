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
const ORG_ID = "95ef9247-f3c6-4482-9c1c-73b955d0306d";
const startedAt = new Date();

console.log(`⏱  Monitor iniciado em ${startedAt.toISOString()}`);
console.log(`📍 Aguardando leads na org Gramado Plaza (${ORG_ID})`);
console.log(`🔄 Poll a cada 3s por 120s — manda a DM agora!\n`);

const seen = new Set();

for (let i = 0; i < 40; i++) {
  const rows = await sql`
    select id, name, whatsapp, campaign_source, utm_campaign, notes, created_at
    from leads
    where organization_id = ${ORG_ID}
      and created_at > ${startedAt}
    order by created_at desc
  `;
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    console.log(`🎯 LEAD NOVO (${new Date().toISOString()}):`);
    console.log(`   name: ${r.name}`);
    console.log(`   whatsapp: ${r.whatsapp}`);
    console.log(`   source: ${r.campaign_source}`);
    console.log(`   ad_id: ${r.utm_campaign}`);
    console.log(`   notes: ${r.notes}\n`);
  }
  process.stdout.write(`.`);
  await new Promise(res => setTimeout(res, 3000));
}

console.log(`\n\n⏱  Monitor encerrado. Total capturado: ${seen.size}`);
