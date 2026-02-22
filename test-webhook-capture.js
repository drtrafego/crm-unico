
const axios = require('axios');

async function testWebhook() {
    const orgSlug = 'unico'; // Assumindo que este é o slug da organização principal
    const webhookUrl = `http://localhost:3000/api/webhooks/${orgSlug}`;

    const testLeads = [
        {
            name: 'Teste Captura Completa',
            email: 'teste@captura.com',
            whatsapp: '5511999999999',
            utm_source: 'google',
            utm_medium: 'cpc',
            utm_campaign: 'black_friday',
            utm_term: 'marketing digital para medicos',
            utm_content: 'banner_vermelho',
            page_path: '/estruturatrafego'
        }
    ];

    console.log('--- Iniciando Teste de Webhook ---');

    for (const lead of testLeads) {
        try {
            console.log(`Enviando lead: ${lead.name}...`);
            const response = await axios.post(webhookUrl, lead, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            console.log('Resposta:', response.data);
        } catch (error) {
            console.error('Erro ao enviar lead:', error.response?.data || error.message);
            console.log('DICA: Certifique-se de que o servidor local está rodando em http://localhost:3000');
        }
    }
}

testWebhook();
