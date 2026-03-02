"use server";

import { db } from "@/lib/db";
import { leads } from "@/server/db/schema";
import { and, eq, gte, lte } from "drizzle-orm";

export async function exportContacts(
    orgId: string,
    type: "email" | "phone" | "both",
    startDate?: string,
    endDate?: string
) {
    try {
        const filters = [eq(leads.organizationId, orgId)];

        if (startDate) {
            filters.push(gte(leads.createdAt, new Date(startDate)));
        }

        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filters.push(lte(leads.createdAt, end));
        }

        const results = await db.query.leads.findMany({
            where: and(...filters),
            orderBy: (leads, { desc }) => [desc(leads.createdAt)],
        });

        const formattedData = results.map((lead) => {
            const data: any = {
                Nome: lead.name,
            };

            if (type === "email" || type === "both") {
                data.Email = lead.email || "";
            }

            if (type === "phone" || type === "both") {
                data.Telefone = lead.whatsapp || "";
            }

            return data;
        });

        return { success: true, data: formattedData };
    } catch (error) {
        console.error("Error exporting contacts:", error);
        return { success: false, error: "Falha ao exportar contatos" };
    }
}
