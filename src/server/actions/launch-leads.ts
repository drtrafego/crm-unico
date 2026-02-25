"use server";

import { db } from "@/lib/db";
import { launchLeads, organizations, leads } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { fetchSheetData } from "@/lib/google-sheets";
import { revalidatePath } from "next/cache";

export async function getLaunchLeads(organizationId: string) {
    try {
        const leads = await db.query.launchLeads.findMany({
            where: eq(launchLeads.organizationId, organizationId),
            orderBy: [desc(launchLeads.createdAt)],
        });

        return leads;
    } catch (error) {
        console.error("Error fetching launch leads:", error);
        throw new Error("Failed to fetch launch leads");
    }
}

export async function getLaunchAnalyticsData(organizationId: string) {
    try {
        // Fetch base leads for UTM analysis
        const baseLeads = await db.query.leads.findMany({
            where: eq(leads.organizationId, organizationId),
            columns: { utmSource: true }
        });

        const totalLeads = baseLeads.length;
        let trackedLeadsCount = 0;
        let p1Count = 0;
        let p2Count = 0;
        let outrosCount = 0;
        const utmCounts: Record<string, number> = {};

        baseLeads.forEach(l => {
            if (l.utmSource) {
                trackedLeadsCount++;
                const source = l.utmSource;
                utmCounts[source] = (utmCounts[source] || 0) + 1;

                const lowerSource = source.toLowerCase();
                if (lowerSource.includes('p1')) p1Count++;
                else if (lowerSource.includes('p2')) p2Count++;
                else outrosCount++;
            } else {
                outrosCount++;
            }
        });

        const trackingRate = totalLeads > 0 ? Math.round((trackedLeadsCount / totalLeads) * 100) : 0;

        const utmRanking = Object.entries(utmCounts)
            .map(([source, leads]) => ({ source, leads }))
            .sort((a, b) => b.leads - a.leads);

        const temperatureData = [
            { name: "P1 Frio", value: p1Count, fill: "hsl(var(--chart-1))" },
            { name: "P2 Quente", value: p2Count, fill: "hsl(var(--chart-2))" },
            { name: "Outros", value: outrosCount, fill: "hsl(var(--muted))" },
        ];

        // Fetch launch leads for form responses analytics
        const launchLeadsList = await db.query.launchLeads.findMany({
            where: eq(launchLeads.organizationId, organizationId),
            columns: { formData: true }
        });

        const totalForms = launchLeadsList.length;

        // Stopwords completely in Portuguese and generic terms
        const stopWords = new Set([
            "o", "a", "os", "as", "um", "uma", "uns", "umas", "e", "ou", "mas", "se", "por", "para", "com", "em", "no", "na",
            "nos", "nas", "de", "do", "da", "dos", "das", "que", "qual", "quais", "quem", "como", "quando", "onde", "porque",
            "porquê", "sim", "não", "eu", "tu", "ele", "ela", "nós", "vós", "eles", "elas", "me", "te", "se", "nos", "vos",
            "lhe", "lhes", "meu", "minha", "meus", "minhas", "seu", "sua", "seus", "suas", "nosso", "nossa", "nossos", "nossas",
            "este", "esta", "estes", "estas", "esse", "essa", "esses", "essas", "aquele", "aquela", "aqueles", "aquelas", "isso",
            "isto", "aquilo", "ser", "estar", "ter", "haver", "fazer", "ir", "poder", "querer", "dizer", "saber", "dar", "ver",
            "mais", "muito", "pouco", "tudo", "nada", "alguém", "ninguém", "algum", "nenhum", "qualquer", "cada", "mesmo", "outro",
            "ainda", "já", "agora", "depois", "antes", "aqui", "ali", "lá", "ai", "muito", "tão", "bem", "mal", "apenas", "só",
            "também", "nem", "sempre", "nunca", "vezes", "vez", "vai", "vou", "estou", "sou", "é", "são", "foi", "foram", "era", "eram",
            "será", "serão", "teria", "tinha", "tinham", "tem", "têm"
        ]);

        const wordCounts: Record<string, number> = {};

        launchLeadsList.forEach(ll => {
            if (ll.formData && typeof ll.formData === 'object') {
                Object.values(ll.formData).forEach(val => {
                    if (typeof val === 'string') {
                        // strip punctuation and spaces
                        const words = val.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, "").split(/\s+/);
                        words.forEach(w => {
                            if (w.length > 3 && !stopWords.has(w) && isNaN(Number(w))) {
                                wordCounts[w] = (wordCounts[w] || 0) + 1;
                            }
                        });
                    }
                });
            }
        });

        const wordCloud = Object.entries(wordCounts)
            .map(([text, value]) => ({ text, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 50);

        return {
            success: true,
            data: {
                totalLeads,
                totalForms,
                trackingRate,
                utmRanking,
                temperatureData,
                wordCloud
            }
        };

    } catch (error: any) {
        console.error("Error fetching analytics data:", error);
        return { success: false, error: "Falha ao carregar dashboard de analítica." };
    }
}

export async function syncLaunchLeadsFromSheet(organizationId: string) {
    try {
        // 1. Get Organization Settings
        const org = await db.query.organizations.findFirst({
            where: eq(organizations.id, organizationId),
        });

        if (!org) {
            return { success: false, error: "Organização não encontrada." };
        }

        const features = org.features || {};
        if (!features.hasLaunchDashboard || !features.launchSheetId) {
            return { success: false, error: "A integração com Google Sheets não está configurada para esta organização." };
        }

        const sheetId = features.launchSheetId;
        const tabName = features.launchSheetTabName || "Página1";

        // 2. Fetch Data from Google Sheets API
        // Read the entire tab starting from A1 to capture dynamic headers
        const rows = await fetchSheetData(sheetId, `'${tabName}'!A:Z`);

        if (!rows || rows.length <= 1) {
            return { success: true, count: 0, message: "A planilha está vazia ou contém apenas os cabeçalhos." };
        }

        const headers = rows[0].map(h => String(h).trim().toLowerCase());
        const dataRows = rows.slice(1);

        // Required mappings
        const nameIdx = headers.findIndex(h => h.includes("nome") || h === "name");
        const emailIdx = headers.findIndex(h => h.includes("e-mail") || h === "email");
        const phoneIdx = headers.findIndex(h => h.includes("telefone") || h.includes("whatsapp") || h === "phone");

        if (emailIdx === -1) {
            return { success: false, error: "Coluna 'E-mail' não encontrada na planilha. Ela é obrigatória para sincronização." };
        }

        // 3. Process and Insert Data
        let newLeadsCount = 0;
        let updatedLeadsCount = 0;

        // Fetch existing emails to prevent duplicates (upsert logic)
        const existingLeads = await db.query.launchLeads.findMany({
            where: eq(launchLeads.organizationId, organizationId),
            columns: { email: true, id: true }
        });
        const existingEmails = new Map(existingLeads.map(l => [l.email.toLowerCase(), l.id]));

        for (const row of dataRows) {
            const email = String(row[emailIdx] || "").trim().toLowerCase();
            const name = nameIdx !== -1 ? String(row[nameIdx] || "").trim() : "Sem Nome";
            const whatsapp = phoneIdx !== -1 ? String(row[phoneIdx] || "").trim() : null;

            if (!email) continue;

            // Build dynamic formData for any remaining header column
            const formData: Record<string, string> = {};
            headers.forEach((headerName, idx) => {
                if (idx !== nameIdx && idx !== emailIdx && idx !== phoneIdx && headerName) {
                    formData[headerName] = String(row[idx] || "");
                }
            });

            const timestampFromSheet = headers.findIndex(h => h.includes("carimbo") || h.includes("data"));
            let rowDate = new Date();
            if (timestampFromSheet !== -1 && row[timestampFromSheet]) {
                const parsed = new Date(row[timestampFromSheet]);
                if (!isNaN(parsed.getTime())) rowDate = parsed;
            }

            const existingId = existingEmails.get(email);
            if (!existingId) {
                // Insert New Lead
                await db.insert(launchLeads).values({
                    organizationId,
                    formName: tabName, // Saving the source tab as Form Name
                    name,
                    email,
                    whatsapp,
                    formData,
                    createdAt: rowDate,
                });
                newLeadsCount++;
                existingEmails.set(email, "temp_inserted_id"); // ensure we don't insert it again in the same run
            } else {
                // Update Existing Lead Data
                await db.update(launchLeads)
                    .set({
                        name,
                        whatsapp: whatsapp || undefined,
                        formData,
                    })
                    .where(eq(launchLeads.id, existingId));
                updatedLeadsCount++;
            }
        }

        revalidatePath(`/org/${org.slug}/launch-leads`);

        return {
            success: true,
            newLeads: newLeadsCount,
            updatedLeads: updatedLeadsCount,
            message: `Sincronização concluída: ${newLeadsCount} novos leads e ${updatedLeadsCount} atualizados.`
        };

    } catch (error: any) {
        console.error("Error syncing Google Sheets:", error);
        return { success: false, error: error.message || "Erro na sincronização." };
    }
}
