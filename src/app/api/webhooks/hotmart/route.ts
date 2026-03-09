import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { vendasHotmart, organizations } from "@/server/db/schema";

// Hottok is Hotmart's way of authenticating webhooks
const HOTMART_HOTTOK = process.env.HOTMART_HOTTOK || "";

export async function POST(req: Request) {
    try {
        // Validate Hottok (Optional based on user preference)
        const hottok = req.headers.get("x-hotmart-hottok");
        if (HOTMART_HOTTOK && hottok !== HOTMART_HOTTOK) {
            console.warn(`Webhook received with invalid/missing Hottok: ${hottok}`);
            // Not blocking the request since you mentioned you usually just use the webhook URL
        }

        const payload = await req.json();
        console.log("HOTMART PAYLOAD RECEBIDO:", JSON.stringify(payload, null, 2));

        // O teste da Hotmart (Painel -> "Enviar prueba de configuración") geralmente não envia o objeto "purchase" e simula outros eventos.
        // Se `data.purchase` estiver vazio, vamos tentar preencher com dados mockados para o teste passar.
        const isTestEvent = !data.purchase;

        const transaction = data.purchase?.transaction || (isTestEvent ? "TESTE_HOTMART_XYZ" : "unknown");
        const status = data.purchase?.status || event;
        const paymentType = data.purchase?.payment?.type || "TEST_PAYMENT";
        const currency = data.purchase?.price?.currency_value || "BRL";
        const price = data.purchase?.price?.value || 0;

        const buyerEmail = data.buyer?.email || "unknown@email.com";
        const buyerName = data.buyer?.name;
        const buyerPhone = data.buyer?.phone || data.buyer?.checkout_phone; // O teste manda "phone", a compra real manda "checkout_phone"

        const productId = data.product?.id?.toString();
        const productName = data.product?.name;
        const productOffer = data.offer?.code || data.product?.offer; // O teste manda offer.code

        const purchaseDate = data.purchase?.order_date ? new Date(data.purchase.order_date) : new Date();
        const approvedDate = data.purchase?.approved_date ? new Date(data.purchase.approved_date) : undefined;

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
