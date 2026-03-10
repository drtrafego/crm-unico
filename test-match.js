const normalizePhone = (p) => {
    if (!p) return null;
    const digits = p.replace(/\D/g, '');
    return digits.length >= 7 ? digits.slice(-7) : digits;
};

const leadsByEmail = new Map();
const leadsByPhone = new Map();

const mockLeads = [
    { email: 'contato@pro.com', whatsapp: '+55 11 98765-4321', utmSource: 'insta_bio' },
    { email: 'outro@leads.com', whatsapp: '11912345678', utmSource: 'google_ads' }
];

mockLeads.forEach(l => {
    leadsByEmail.set(l.email.toLowerCase(), l);
    const p7 = normalizePhone(l.whatsapp);
    if (p7) leadsByPhone.set(p7, l);
});

const testSales = [
    { name: 'Match por Email', email: 'CONTATO@PRO.COM', phone: '0000000', expected: 'insta_bio' },
    { name: 'Match por Telefone (7 digitos)', email: 'unknown@email.com', phone: '912345678', expected: 'google_ads' },
    { name: 'Sem Match', email: 'nada@nada.com', phone: '1111111', expected: undefined }
];

console.log('--- VERIFICANDO LÓGICA DE CORRELAÇÃO ---');
testSales.forEach(s => {
    const p7 = normalizePhone(s.phone);
    const match = leadsByEmail.get(s.email.toLowerCase()) || (p7 ? leadsByPhone.get(p7) : null);

    const result = match ? match.utmSource : undefined;
    const passed = result === s.expected;
    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${s.name}: Result=${result}, Expected=${s.expected}`);
});
