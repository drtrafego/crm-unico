
import { Lead, Column } from "@/server/db/schema";
import { getLeadSource } from "./leads-helper";

export interface AnalyticsData {
    sourceData: { name: string; value: number }[];
    campaignData: { name: string; leads: number }[];
    pageData: { name: string; leads: number }[];
    conversionBySource: { name: string; total: number; won: number; rate: number }[];
}

export function processAnalyticsData(leads: Lead[]): AnalyticsData {
    const sourceMap = new Map<string, number>();
    const campaignMap = new Map<string, number>();
    const pageMap = new Map<string, number>();

    leads.forEach((lead) => {
        // 1. Source (Normalized)
        const source = getLeadSource(lead);
        sourceMap.set(source, (sourceMap.get(source) || 0) + 1);

        // 2. Campaign (UTM Campaign)
        if (lead.utmCampaign || lead.campaignSource) {
            const campaign = lead.utmCampaign || lead.campaignSource || "Desconhecido";
            campaignMap.set(campaign, (campaignMap.get(campaign) || 0) + 1);
        }

        // 3. Page (Slug/PagePath)
        if (lead.pagePath) {
            let cleanPath = lead.pagePath;
            try {
                if (cleanPath.startsWith('http')) {
                    cleanPath = new URL(cleanPath).pathname;
                }
            } catch (e) {
                // ignore
            }
            if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
                cleanPath = cleanPath.slice(0, -1);
            }
            pageMap.set(cleanPath, (pageMap.get(cleanPath) || 0) + 1);
        }
    });

    // Transform Maps
    const sourceData = Array.from(sourceMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    const campaignData = Array.from(campaignMap.entries())
        .map(([name, leads]) => ({ name, leads }))
        .sort((a, b) => b.leads - a.leads)
        .slice(0, 10);

    const pageData = Array.from(pageMap.entries())
        .map(([name, leads]) => ({ name, leads }))
        .sort((a, b) => b.leads - a.leads)
        .slice(0, 10);

    return {
        sourceData,
        campaignData,
        pageData,
        conversionBySource: []
    };
}

export function calculateConversionBySource(leads: Lead[], isWon: (lead: Lead) => boolean) {
    const conversionMap = new Map<string, { total: number; won: number }>();

    leads.forEach(lead => {
        const source = getLeadSource(lead);
        if (!conversionMap.has(source)) {
            conversionMap.set(source, { total: 0, won: 0 });
        }
        const stat = conversionMap.get(source)!;
        stat.total += 1;
        if (isWon(lead)) {
            stat.won += 1;
        }
    });

    return Array.from(conversionMap.entries())
        .map(([name, stat]) => ({
            name,
            total: stat.total,
            won: stat.won,
            rate: stat.total > 0 ? Math.round((stat.won / stat.total) * 100) : 0
        }))
        .sort((a, b) => b.rate - a.rate);
}

// Stop words list refined (Removed "não", "sem" to capture negation)
const STOP_WORDS = new Set([
    "de", "a", "o", "que", "e", "do", "da", "em", "um", "para", "é", "com", "uma", "os", "no", "se", "na", "por", "mais", "as", "dos", "como", "mas", "foi", "ao", "ele", "das", "tem", "à", "seu", "sua", "ou", "ser", "quando", "muito", "há", "nos", "já", "está", "eu", "também", "só", "pelo", "pela", "até", "isso", "ela", "entre", "era", "depois", "mesmo", "aos", "ter", "seus", "quem", "nas", "me", "esse", "eles", "estão", "você", "tinha", "foram", "essa", "num", "nem", "suas", "meu", "às", "minha", "têm", "numa", "pelos", "elas", "havia", "seja", "qual", "será", "nós", "tenho", "lhe", "deles", "essas", "esses", "pelas", "este", "fosse", "dele", "tu", "te", "vcs", "cliente", "lead", "contato", "sobre", "falar", "hoje", "agora", "bom", "dia", "tarde", "noite", "ola", "olá", "oi", "tudo", "bem", "fala"
]);

export function analyzeKeywords(leads: Lead[], isWon: (l: Lead) => boolean, isLost: (l: Lead) => boolean) {
    const processText = (text: string) => {
        return text.toLowerCase()
            .replace(/[^\w\sà-ú]/g, '')
            .split(/\s+/)
            .filter(w => w.length >= 2 && !STOP_WORDS.has(w));
    };

    const wonWords: Record<string, number> = {};
    const lostWords: Record<string, number> = {};
    const activeWords: Record<string, number> = {};

    leads.forEach(lead => {
        if (!lead.notes) return;
        const words = processText(lead.notes);

        // Look for bigrams starting with negation
        for (let i = 0; i < words.length; i++) {
            const w = words[i];

            // Contextual analysis: check next word if current is negation
            if ((w === 'não' || w === 'sem') && i < words.length - 1) {
                const bigram = `${w} ${words[i + 1]}`;
                if (isWon(lead)) wonWords[bigram] = (wonWords[bigram] || 0) + 1;
                else if (isLost(lead)) lostWords[bigram] = (lostWords[bigram] || 0) + 1;
                else activeWords[bigram] = (activeWords[bigram] || 0) + 1;
            }

            // Always count individual words too (unless it's a stop word we missed)
            if (isWon(lead)) wonWords[w] = (wonWords[w] || 0) + 1;
            else if (isLost(lead)) lostWords[w] = (lostWords[w] || 0) + 1;
            else activeWords[w] = (activeWords[w] || 0) + 1;
        }
    });

    const getTop = (map: Record<string, number>) => Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15) // Increased limit
        .map(([word, count]) => ({ word, count }));

    return {
        won: getTop(wonWords),
        lost: getTop(lostWords),
        active: getTop(activeWords)
    };
}
