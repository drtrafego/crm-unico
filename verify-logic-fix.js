
// Mock do comportamento do Webhook ANTES da minha correção
function OLD_normalizeAndSave(rawData) {
    const utmSource = rawData.utm_source || rawData.source;
    const utmMedium = rawData.utm_medium || rawData.medium;
    const utmCampaign = rawData.utm_campaign || rawData.campaign;

    // Campos salvos no BD no código antigo (Linhas 172-186 do route.ts original)
    return {
        name: rawData.name || "Sem Nome",
        email: rawData.email,
        campaignSource: rawData.utm_source || "Direto",
        utmSource: utmSource,
        utmMedium: utmMedium,
        utmCampaign: utmCampaign
        // utmTerm, utmContent e pagePath NÃO estavam aqui!
    };
}

// Mock do comportamento do Webhook DEPOIS da minha correção
function NEW_normalizeAndSave(rawData) {
    const utmSource = rawData.utm_source || rawData.source;
    const utmMedium = rawData.utm_medium || rawData.medium;
    const utmCampaign = rawData.utm_campaign || rawData.campaign;
    const utmTerm = rawData.utm_term || rawData.term || rawData.keyword;
    const utmContent = rawData.utm_content || rawData.content;
    const pagePath = rawData.page_path || rawData.page || rawData.url;

    return {
        name: rawData.name || "Sem Nome",
        email: rawData.email,
        campaignSource: rawData.utm_source || "Direto",
        utmSource: utmSource,
        utmMedium: utmMedium,
        utmCampaign: utmCampaign,
        utmTerm: utmTerm,
        utmContent: utmContent,
        pagePath: pagePath
    };
}

const inputData = {
    name: 'Lead de Teste',
    utm_source: 'google',
    utm_term: 'marketing digital para medicos',
    page_path: '/estruturatrafego'
};

console.log('--- TESTE DE CAPTURA DE DADOS ---');
console.log('Dados enviados pela Landing Page:', JSON.stringify(inputData, null, 2));
console.log('\n[ANTES] O que o banco de dados recebia:');
console.log(JSON.stringify(OLD_normalizeAndSave(inputData), null, 2));
console.log('\n[DEPOIS] O que o banco de dados recebe agora:');
console.log(JSON.stringify(NEW_normalizeAndSave(inputData), null, 2));
