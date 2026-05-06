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

const deleted = await sql`
  delete from leads
  where organization_id = '95ef9247-f3c6-4482-9c1c-73b955d0306d'
    and (whatsapp like 'fb:test_psid_e2e%' or whatsapp like 'ig:test_ig_sender%')
  returning id, name, whatsapp
`;
console.log(`Deletados ${deleted.length} leads de teste:`);
console.log(JSON.stringify(deleted, null, 2));
