
import fetch from "node-fetch";

const WEBHOOK_URL = "http://localhost:3000/api/webhooks/felipe-matias";

async function main() {
    console.log(`Sending POST request to ${WEBHOOK_URL}...`);

    const payload = {
        name: "Teste Google Script",
        email: "teste.google.script@example.com",
        phone: "11999998888",
        message: "Lead de teste gerado via script para validar UTMs",
        utm_source: "google",
        utm_medium: "cpc",
        utm_campaign: "teste-integracao"
    };

    try {
        const response = await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log("Response status:", response.status);
        console.log("Response body:", data);

        if (response.ok) {
            console.log("\n✅ Webhook test successful!");
        } else {
            console.error("\n❌ Webhook test failed.");
        }

    } catch (error) {
        console.error("Error sending request:", error);
        console.log("\n⚠️ Certifique-se de que o servidor local está rodando em http://localhost:3000");
    }
}

main();
