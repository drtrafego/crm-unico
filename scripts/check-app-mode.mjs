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

const APP_ID = "917411172673844";
const APP_SECRET = process.env.META_APP_SECRET;
const BASE = "https://graph.facebook.com/v21.0";
const appToken = `${APP_ID}|${APP_SECRET}`;

async function gql(path) {
  const r = await fetch(`${BASE}/${path}${path.includes("?") ? "&" : "?"}access_token=${appToken}`);
  const j = await r.json();
  return { status: r.status, data: j };
}

const tries = [
  "917411172673844?fields=id,name,namespace,category,link,company,app_domains,app_type,privacy_policy_url,terms_of_service_url",
  "917411172673844?fields=app_install_type",
  "917411172673844/roles",
];

for (const t of tries) {
  console.log(`\n=== ${t} ===`);
  const r = await gql(t);
  console.log(`HTTP ${r.status}:`, JSON.stringify(r.data, null, 2));
}
