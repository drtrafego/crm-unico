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
const BASE = "https://graph.facebook.com/v21.0";

async function run() {
  // pega Page do Gramado
  const pagesRes = await fetch(`${BASE}/me/accounts?fields=id,name,access_token,instagram_business_account&limit=100&access_token=${TOKEN}`);
  const pages = (await pagesRes.json()).data || [];
  const gramado = pages.find(p => p.name.toLowerCase().includes("gramado"));
  if (!gramado) { console.log("page gramado não encontrada"); return; }

  console.log("Gramado page:", { id: gramado.id, name: gramado.name, ig: gramado.instagram_business_account?.id });
  const pageToken = gramado.access_token;
  const igId = gramado.instagram_business_account?.id;

  console.log("\n=== IG conversations (via PAGE token) ===");
  const conv1 = await fetch(`${BASE}/${igId}/conversations?platform=instagram&access_token=${pageToken}`);
  console.log(JSON.stringify(await conv1.json(), null, 2));

  console.log("\n=== IG conversations (via PAGE ID) ===");
  const conv2 = await fetch(`${BASE}/${gramado.id}/conversations?platform=instagram&access_token=${pageToken}`);
  console.log(JSON.stringify(await conv2.json(), null, 2));

  console.log("\n=== Page conversations default platform ===");
  const conv3 = await fetch(`${BASE}/${gramado.id}/conversations?access_token=${pageToken}`);
  console.log(JSON.stringify(await conv3.json(), null, 2));
}

run().catch(e => { console.error(e); process.exit(1); });
