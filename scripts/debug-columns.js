
const { drizzle } = require("drizzle-orm/neon-http");
const { neon } = require("@neondatabase/serverless");
const { config } = require("dotenv");
const { pgTable, text, integer } = require("drizzle-orm/pg-core");

config({ path: ".env.local" });

const columns = pgTable("columns", {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    order: integer("order").notNull(),
});

async function main() {
    const db = drizzle(neon(process.env.DATABASE_URL));
    const res = await db.select().from(columns);
    console.log("TITLES:", res.map(c => c.title).join(" | "));
}

main();
