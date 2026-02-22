
const { db } = require('./src/lib/db');
const { leads } = require('./src/server/db/schema');
const { desc, isNotNull } = require('drizzle-orm');

async function checkData() {
    try {
        const recentLeads = await db.select({
            id: leads.id,
            name: leads.name,
            utmTerm: leads.utmTerm,
            pagePath: leads.pagePath,
            createdAt: leads.createdAt
        })
            .from(leads)
            .where(isNotNull(leads.utmTerm))
            .orderBy(desc(leads.createdAt))
            .limit(10);

        console.log('--- LEADS COM UTM_TERM NO BANCO ---');
        console.table(recentLeads);

        const totalLeads = await db.select({ count: leads.id }).from(leads);
        const withTerm = await db.select({ count: leads.id }).from(leads).where(isNotNull(leads.utmTerm));

        console.log(`\nTotal de leads: ${totalLeads.length}`);
        console.log(`Leads com utmTerm: ${withTerm.length}`);
    } catch (error) {
        console.error('Erro ao consultar banco:', error.message);
    }
}

checkData();
