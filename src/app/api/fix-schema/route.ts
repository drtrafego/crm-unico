
import { adminDb } from "@/lib/db";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const results = [];

        // List of columns to ensure exist
        const columnsToAdd = [
            "ADD COLUMN IF NOT EXISTS first_contact_at TIMESTAMP",
            "ADD COLUMN IF NOT EXISTS follow_up_date TIMESTAMP",
            "ADD COLUMN IF NOT EXISTS follow_up_note TEXT",
            "ADD COLUMN IF NOT EXISTS value DECIMAL(10, 2)",
            "ADD COLUMN IF NOT EXISTS utm_source TEXT",
            "ADD COLUMN IF NOT EXISTS utm_medium TEXT",
            "ADD COLUMN IF NOT EXISTS utm_campaign TEXT",
            "ADD COLUMN IF NOT EXISTS whatsapp TEXT",
            "ADD COLUMN IF NOT EXISTS campaign_source TEXT"
        ];

        for (const colDef of columnsToAdd) {
            try {
                await adminDb.execute(sql.raw(`ALTER TABLE leads ${colDef};`));
                results.push(`Success: ${colDef}`);
            } catch (error: any) {
                results.push(`Error executing ${colDef}: ${error.message}`);
            }
        }

        return NextResponse.json({
            message: "Schema Update Attempted",
            results
        }, { status: 200 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
