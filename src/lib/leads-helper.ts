/**
 * Normaliza a origem do lead.
 * Prioridade:
 * 1. Origem explícita (campaignSource)
 * 2. Dedução via UTM (utmSource)
 * 3. Fallback (Direto/Sem Origem)
 */
export const getLeadSource = (lead: any) => {
    // Combine fields to check for keywords (retroactive normalization)
    const rawToCheck = (lead.campaignSource || lead.utmSource || "").toLowerCase().trim();

    // Regras para Meta/Facebook
    if (
        rawToCheck === 'facebook' ||
        rawToCheck === 'meta' ||
        rawToCheck === 'instagram' ||
        rawToCheck.includes('facebook') ||
        rawToCheck.includes('meta')
    ) {
        return "Meta";
    }

    // Regras para Google/Ads
    if (
        rawToCheck === 'google' ||
        rawToCheck === 'adwords' ||
        rawToCheck === 'google_ads' ||
        rawToCheck.includes('google') ||
        rawToCheck.includes('adwords')
    ) {
        return "Google";
    }

    // Se não caiu nas regras acima, retorna o valor original ou "Direto"
    return lead.campaignSource || "Direto";
};
