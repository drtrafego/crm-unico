import { google } from "googleapis";
import { db } from "../../lib/db";
import { launchLeads } from "../db/schema";
import { eq, and } from "drizzle-orm";

interface FetchLaunchLeadsParams {
    spreadsheetId: string;
    range: string;
    organizationId: string;
    formName: string;
}

export async function fetchAndSyncGoogleSheetData({
    spreadsheetId,
    range,
    organizationId,
    formName,
}: FetchLaunchLeadsParams) {
    try {
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_CLIENT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
            },
            scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
        });

        const sheets = google.sheets({ version: "v4", auth });

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            console.log("No data found in the spreadsheet.");
            return { success: true, count: 0 };
        }

        // Assuming first row is headers
        const headers = rows[0] as string[];
        const dataRows = rows.slice(1);

        let syncedCount = 0;

        for (const row of dataRows) {
            const rowData: Record<string, any> = {};
            headers.forEach((header, index) => {
                rowData[header] = row[index];
            });

            // Extract basic fields (adjust header names based on actual sheet)
            const name = rowData["Nome"] || rowData["Name"] || "Sem Nome";
            const email = rowData["E-mail"] || rowData["Email"];
            const whatsapp = rowData["WhatsApp"] || rowData["Telefone"] || null;
            const utmSource = rowData["utm_source"] || null;
            const utmMedium = rowData["utm_medium"] || null;
            const utmCampaign = rowData["utm_campaign"] || null;

            if (!email) continue; // Skip if no email is provided

            // Check if lead already exists for this form
            const existing = await db.query.launchLeads.findFirst({
                where: and(
                    eq(launchLeads.email, email),
                    eq(launchLeads.formName, formName),
                    eq(launchLeads.organizationId, organizationId)
                ),
            });

            if (!existing) {
                await db.insert(launchLeads).values({
                    organizationId,
                    formName,
                    name,
                    email,
                    whatsapp,
                    utmSource,
                    utmMedium,
                    utmCampaign,
                    formData: rowData, // store all raw data as JSON
                });
                syncedCount++;
            }
        }

        return { success: true, count: syncedCount };
    } catch (error) {
        console.error("Error fetching/syncing Google Sheet data:", error);
        return { success: false, error: "Failed to sync data" };
    }
}
