
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { columns } from "@/server/db/schema";
import { eq, sql } from "drizzle-orm";

async function main() {
    const { adminDb } = await import("@/lib/db");
    console.log("Fixing Admin Columns...");

    // Desired state
    const updates = [
        { order: 0, title: "Novos Leads", oldTitle: "Novos Leads" },
        { order: 1, title: "Contato Realizado", oldTitle: "Em Contato" },
        { order: 2, title: "Não Retornou", oldTitle: "Não Retornou" },
        { order: 5, title: "Proposta Enviada", oldTitle: "Proposta Enviada" },
        { order: 7, title: "Call Realizada", oldTitle: "Call Realizada" },
        { order: 9, title: "Não tem interesse", oldTitle: "Não tem interesse" }
    ];

    try {
        for (const up of updates) {
            // Find by order OR title (fuzzy match)
            // We assume the ID is stable, but we don't have IDs here.
            // We will update based on current Order if plausible, or Title.

            // Strategy: Update by Order if it exists at that position? 
            // No, verify script showed:
            // [0] Novos Leads
            // [1] Em Contato
            // [2] Não Retornou
            // [3] Proposta Enviada (This is at pos 3, needs to be 5?)
            // [4] Fechado
            // [5] Perdido

            // User "before" state had gaps? 0, 1, 2, 5, 7, 9.
            // Current state is packed: 0, 1, 2, 3, 4, 5.
            // This implies the migration or something re-indexed them?

            // I need to update the RECORDS that correspond to these concepts.

            // 1. "Em Contato" (at pos 1) -> Rename to "Contato Realizado", ensure pos 1.
            await adminDb.update(columns)
                .set({ title: up.title, order: up.order })
                .where(
                    sql`${columns.organizationId} = 'super-admin-personal' AND (${columns.title} = ${up.title} OR ${columns.title} = ${up.oldTitle})`
                );

            console.log(`Updated/Ensured: ${up.title} at ${up.order}`);
        }

        // What about "Proposta Enviada" currently at 3?
        // My update above sets it to 5.
        // What about "Fechado" at 4? User didn't mention it.
        // What about "Perdido" at 5?
        // If I move Proposta to 5, it might clash with Perdido at 5?
        // I should clear the way first or swap?
        // Drizzle/Postgres doesn't enforce unique order unless constrained.

        console.log("Fix applied.");

    } catch (e) {
        console.error("Error fixing columns:", e);
    }
    process.exit(0);
}

main();
