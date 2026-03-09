import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { vendasHotmart, organizations } from "@/server/db/schema";

// Hottok is Hotmart's way of authenticating webhooks
const HOTMART_HOTTOK = process.env.HOTMART_HOTTOK || "";

export async function POST(req: Request) {
    try {
        // Validate Hottok
        const hottok = req.headers.get("x-hotmart-hottok");
        if (HOTMART_HOTTOK && hottok !== HOTMART_HOTTOK) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const payload = await req.json();

        // Hotmart Webhook 2.0 format
        const event = payload.event;
        const data = payload.data;

        if (!data || !data.purchase) {
            return NextResponse.json({ message: "Ignored event type or missing data" }, { status: 200 });
        }

        const transaction = data.purchase.transaction;
        const status = data.purchase.status;
        const paymentType = data.purchase.payment?.type;
        const currency = data.purchase.price?.currency_value;
        const price = data.purchase.price?.value;
        const buyerEmail = data.buyer?.email;
        const buyerName = data.buyer?.name;
        const buyerPhone = data.buyer?.checkout_phone;
        const productId = data.product?.id?.toString();
        const productName = data.product?.name;
        const productOffer = data.product?.offer;
        const purchaseDate = data.purchase.order_date ? new Date(data.purchase.order_date) : undefined;
        const approvedDate = data.purchase.approved_date ? new Date(data.purchase.approved_date) : undefined;

        // Need an organization to link this sale to. 
        // For MVPs, we might hardcode, or look up by a configured product ID, or use the first org.
        let orgId;
        const orgs = await db.select().from(organizations).limit(1);
        if (orgs.length > 0) {
            orgId = orgs[0].id;
        } else {
            console.warn("Hotmart Webhook: No organization found to assign the sale.");
            throw new Error("No organization found to assign the sale to.");
        }

        // Insert into database
        await db.insert(vendasHotmart).values({
            organizationId: orgId,
            transaction: transaction || "unknown",
            status: status || event,
            paymentType,
            currency,
            price: price ? price.toString() : null,
            buyerEmail: buyerEmail || "unknown@email.com",
            buyerName,
            buyerPhone,
            productId,
            productName,
            productOffer,
            purchaseDate,
            approvedDate
        });

        return NextResponse.json({ success: true, message: "Webhook processed" }, { status: 200 });
    } catch (error) {
        console.error("Hotmart Webhook Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
