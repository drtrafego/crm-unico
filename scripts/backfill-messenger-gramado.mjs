import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { randomUUID } from "crypto";

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
const sql = neon(process.env.DATABASE_URL_CLIENTS);

const ORG_SLUG = "gramado-plaza";

async function fetchAllConversations(pageId, pageToken) {
  const results = [];
  let url = `${BASE}/${pageId}/conversations?fields=participants,messages.limit(5){id,from,to,message,created_time},updated_time&limit=25&access_token=${pageToken}`;
  let page = 1;
  while (url) {
    const res = await fetch(url);
    const j = await res.json();
    if (j.error) { console.error("ERR:", j.error); break; }
    results.push(...(j.data || []));
    url = j.paging?.next || null;
    page++;
    if (page > 10) break;
  }
  return results;
}

async function ensureColumns(orgId) {
  const existing = await sql`select id, title, "order" from columns where organization_id = ${orgId} order by "order" asc`;
  if (existing.length > 0) return existing;
  const titles = ["Novos Leads", "Em Contato", "Não Retornou", "Proposta Enviada", "Fechado", "Perdido"];
  const inserted = [];
  for (let i = 0; i < titles.length; i++) {
    const [row] = await sql`insert into columns (id, title, organization_id, "order") values (${randomUUID()}, ${titles[i]}, ${orgId}, ${i}) returning id, title, "order"`;
    inserted.push(row);
  }
  return inserted.sort((a, b) => a.order - b.order);
}

async function run() {
  const [org] = await sql`select id, name from organizations where slug = ${ORG_SLUG}`;
  if (!org) { console.log("Org não encontrada"); return; }
  console.log(`Org: ${org.name} (${org.id})`);

  const pagesRes = await fetch(`${BASE}/me/accounts?fields=id,name,access_token,instagram_business_account&limit=100&access_token=${TOKEN}`);
  const pages = (await pagesRes.json()).data || [];
  const gramado = pages.find(p => p.name.toLowerCase().includes("gramado"));
  if (!gramado) { console.log("Page Gramado não encontrada"); return; }
  console.log(`Page Messenger: ${gramado.name} (${gramado.id})`);

  const convs = await fetchAllConversations(gramado.id, gramado.access_token);
  console.log(`Total conversas: ${convs.length}`);

  const columns = await ensureColumns(org.id);
  const firstCol = columns[0];
  console.log(`Coluna destino: ${firstCol.title} (${firstCol.id})`);

  let created = 0, skipped = 0, errors = 0;

  for (const conv of convs) {
    try {
      const participants = conv.participants?.data || [];
      const lead = participants.find(p => p.id !== gramado.id);
      if (!lead) { skipped++; continue; }

      const identifier = `fb:${lead.id}`;
      const existing = await sql`select id from leads where organization_id = ${org.id} and whatsapp = ${identifier} limit 1`;
      if (existing.length) { skipped++; continue; }

      const msgs = conv.messages?.data || [];
      const lastUserMsg = msgs.find(m => m.from?.id === lead.id);
      const firstMsg = lastUserMsg?.message || msgs[0]?.message || "Primeira DM no Facebook Messenger";
      const createdAt = lastUserMsg?.created_time || conv.updated_time || new Date().toISOString();

      const leadId = randomUUID();
      await sql`
        insert into leads (
          id, name, whatsapp, email, company, status, notes,
          organization_id, column_id, campaign_source,
          utm_source, utm_medium, utm_campaign,
          created_at
        )
        values (
          ${leadId}, ${lead.name || `FB Lead ${lead.id.slice(-6)}`}, ${identifier}, null, null,
          ${"New"}, ${"Messenger: " + firstMsg.slice(0, 400)},
          ${org.id}, ${firstCol.id}, ${"Messenger"},
          ${"messenger"}, ${"cpc"}, null,
          ${createdAt}
        )
      `;
      created++;
      console.log(`  ✓ ${lead.name} (${identifier}) — ${firstMsg.slice(0, 50)}`);
    } catch (e) {
      errors++;
      console.log(`  ✗ erro: ${e.message}`);
    }
  }

  console.log(`\n=== RESULTADO ===`);
  console.log(`Criados: ${created}`);
  console.log(`Já existiam: ${skipped}`);
  console.log(`Erros: ${errors}`);
}

run().catch(e => { console.error(e); process.exit(1); });
