/**
 * Normaliza a origem do lead.
 * Prioridade:
 * 1. Origem explícita (campaignSource)
 * 2. Dedução via UTM (utmSource)
 * 3. Fallback (Direto/Sem Origem)
 *
 * Sources suportados:
 * - Google (Google Ads, AdWords)
 * - Meta (Facebook Ads genérico)
 * - WhatsApp (Click-to-WhatsApp campaigns / mensagens via WABA)
 * - Direct (Instagram Direct / DM campaigns)
 * - Orgânicos (SEO, tráfego orgânico)
 * - Captação Ativa (prospecção ativa)
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

    // WhatsApp (DEVE vir ANTES de "Meta" para não ser capturado pelo genérico)
    // Aceita: "whatsapp", "waba", "ctwa" (click-to-whatsapp), "wpp"
    if (
        lower === 'whatsapp' ||
        lower === 'waba' ||
        lower === 'wpp' ||
        lower.includes('click-to-whatsapp') ||
        lower.includes('ctwa')
    ) {
        return "WhatsApp";
    }

    // Instagram Direct (DEVE vir ANTES de "Meta" para não ser capturado pelo genérico)
    // Aceita: "direct", "instagram_direct", "ig_direct", "dm", "instagram_dm"
    if (
        lower === 'direct' ||
        lower === 'dm' ||
        lower === 'ig_direct' ||
        lower === 'instagram_direct' ||
        lower === 'instagram_dm' ||
        lower === 'ig_dm'
    ) {
        return "Direct";
    }

    // Meta / Facebook / Instagram genérico (Ads, forms, etc.)
    if (
        lower.includes('meta') ||
        lower.includes('facebook') ||
        lower.includes('face') ||
        lower.includes('fb') ||
        lower.includes('instagram') ||
        lower.includes('insta') ||
        lower.includes('ig') ||
        lower.includes('bio')
    ) {
        return "Meta";
    }

    // Orgânico / SEO (removido "direct" daqui - agora é Instagram Direct)
    if (
        lower.includes('organic') ||
        lower.includes('organico') ||
        lower.includes('orgânico') ||
        lower.includes('direto') ||
        lower.includes('seo')
    ) {
        return "Orgânicos";
    }

    // Captação Ativa
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
