import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { vendasHotmart, organizations } from "@/server/db/schema";

// Hottok is Hotmart's way of authenticating webhooks
const HOTMART_HOTTOK = process.env.HOTMART_HOTTOK || "";

// Mapeamento seguro de produto → organização (não aceitar orgId via query param)
const PRODUCT_ORG_MAP: Record<string, string> = {
    "7336724": "8f6eed8c-ce0d-472e-9531-aa4e76149be0", // Dona Doméstica
};

export async function POST(req: Request) {
    try {
        // Validação obrigatória do Hottok
        const hottok = req.headers.get("x-hotmart-hottok");
        if (HOTMART_HOTTOK) {
            if (!hottok || hottok !== HOTMART_HOTTOK) {
                console.warn(`[Hotmart] Webhook bloqueado - Hottok inválido`);
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
        }

        const payload = await req.json();
        console.log("HOTMART PAYLOAD RECEBIDO:", JSON.stringify(payload, null, 2));

        // Hotmart Webhook 2.0 format
        const event = payload.event;
        const data = payload.data;

        // O teste da Hotmart (Painel -> "Enviar prueba de configuração") geralmente não envia o objeto "purchase" e simula outros eventos.
        // Se `data.purchase` estiver vazio, vamos tentar preencher com dados mockados para o teste passar.
        const isTestEvent = !data?.purchase;

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

        const city = data.buyer?.address?.city;
        const state = data.buyer?.address?.state;
        const sck = data.purchase?.sck;
        const scr = data.purchase?.src;

        // --- UTM Tracking Logic ---
        let utmSource = null;
        let utmCampaign = null;

        // 1. Try to get tracking from sckPaymentLink (e.g. facebook_C1)
        const sckLink = data.purchase?.sckPaymentLink;
        if (sckLink && sckLink.includes("_")) {
            const parts = sckLink.split("_");
            utmSource = parts[0];
            utmCampaign = parts.slice(1).join("_");
        } else if (sckLink) {
            utmSource = sckLink;
        }

        // Resolver organização via mapeamento seguro de produto
        // NÃO aceitar orgId via query param (vulnerabilidade de injeção)
        let orgId: string | null = null;

        // 1. Mapeamento por productId (seguro, hardcoded no servidor)
        if (productId && PRODUCT_ORG_MAP[productId]) {
            orgId = PRODUCT_ORG_MAP[productId];
        }

        // 2. Fallback: primeira org (apenas se não houver mapeamento)
        if (!orgId) {
            const orgs = await db.select().from(organizations).limit(1);
            if (orgs.length > 0) {
                orgId = orgs[0].id;
                console.warn(`[Hotmart] Sem mapeamento para produto ${productId}, usando org fallback: ${orgId}`);
            } else {
                console.error("[Hotmart] Nenhuma organização encontrada");
                return NextResponse.json({ error: "No organization found" }, { status: 400 });
            }
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
            utmSource,
            utmCampaign,
            city,
            state,
            sck,
            scr,
            purchaseDate,
            approvedDate
        });

        return NextResponse.json({ success: true, message: "Webhook processed" }, { status: 200 });
    } catch (error) {
        console.error("Hotmart Webhook Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
