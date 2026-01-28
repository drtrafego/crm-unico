/**
 * Normaliza a origem do lead.
 * Prioridade:
 * 1. Origem explícita (campaignSource)
 * 2. Dedução via UTM (utmSource)
 * 3. Fallback (Direto/Sem Origem)
 */
/**
 * Normaliza uma string de origem para os padrões do sistema.
 */
export const normalizeSourceString = (raw: string): string | null => {
    if (!raw) return null;
    const lower = raw.toLowerCase().trim();

    // Google / Ads
    if (lower.includes('google') || lower.includes('adwords') || lower.includes('gads')) {
        return "Google";
    }

    // Meta / Facebook / Instagram
    if (
        lower.includes('meta') ||
        lower.includes('facebook') ||
        lower.includes('face') ||
        lower.includes('fb') ||
        lower.includes('instagram') ||
        lower.includes('insta') ||
        lower.includes('ig')
    ) {
        return "Meta";
    }

    // Orgânico / Direct / SEO
    if (
        lower.includes('organic') ||
        lower.includes('organico') ||
        lower.includes('orgânico') ||
        lower.includes('direct') ||
        lower.includes('direto') ||
        lower.includes('seo')
    ) {
        return "Orgânicos";
    }

    // Captação Ativa (exemplo comum, mantendo por precaução se houver)
    if (lower.includes('captacao') || lower.includes('captação') || lower.includes('ativa')) {
        return "Captação Ativa";
    }

    return null;
};

/**
 * Normaliza a origem do lead para exibição.
 */
export const getLeadSource = (lead: any) => {
    // 1. Tenta normalizar o campaignSource existente
    if (lead.campaignSource) {
        const normalized = normalizeSourceString(lead.campaignSource);
        if (normalized) return normalized;
        // Se não normalizou (ex: "Indicação"), retorna o original
        return lead.campaignSource;
    }

    // 2. Tenta deduzir via UTM
    if (lead.utmSource) {
        const normalized = normalizeSourceString(lead.utmSource);
        if (normalized) return normalized;
        // Se tem UTM mas não bateu regra, retorna a UTM
        return lead.utmSource;
    }

    // 3. Fallback
    return "Direto";
};
