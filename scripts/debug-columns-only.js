
const { drizzle } = require("drizzle-orm/neon-http");
const { neon } = require("@neondatabase/serverless");
const { config } = require("dotenv");
const { pgTable, text } = require("drizzle-orm/pg-core");

config({ path: ".env.local" });

const columns = pgTable("columns", {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
});

async function main() {
    const db = drizzle(neon(process.env.DATABASE_URL));
    const res = await db.select().from(columns);
    console.log("COLUMN MAPPING:");
    res.forEach(c => console.log(`ID: ${c.id} -> Title: ${c.title}`));
}

main();
