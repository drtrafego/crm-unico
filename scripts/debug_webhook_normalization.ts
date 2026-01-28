
// COPY OF LOGIC FROM route.ts for debugging

function normalizeLeadData(rawData: Record<string, any>) {
    // First, check if data is in Elementor format: fields[fieldname][value]
    const elementorData: Record<string, string> = {};
    for (const key of Object.keys(rawData)) {
        // Match pattern: fields[NAME][value] or fields[NAME][raw_value]
        const match = key.match(/^fields\[(\w+)\]\[(value|raw_value)\]$/);
        if (match) {
            const fieldName = match[1].toLowerCase();
            // Prefer raw_value if exists, otherwise use value
            if (!elementorData[fieldName] || match[2] === 'raw_value') {
                elementorData[fieldName] = String(rawData[key]);
            }
        }
    }

    // Merge: use Elementor data if available, otherwise use raw data
    const dataToNormalize = Object.keys(elementorData).length > 0 ? elementorData : rawData;

    // Field name mappings (now simpler since Elementor data is pre-processed)
    const nameFields = ['name', 'nome', 'nome_completo', 'full_name', 'fullname'];
    const emailFields = ['email', 'e-mail', 'email_corporativo'];
    const phoneFields = ['phone', 'telefone', 'whatsapp', 'celular', 'tel', 'fone'];
    const companyFields = ['company', 'empresa', 'company_name'];
    const messageFields = ['message', 'mensagem', 'notes', 'observacoes', 'observacao'];

    const findValue = (fields: string[]) => {
        for (const field of fields) {
            // CURRENT LOGIC:
            // dataToNormalize[field] -> lookup 'nome'
            // dataToNormalize[field.toLowerCase()] -> lookup 'nome' (redundant if field is already lower)
            const value = dataToNormalize[field] || dataToNormalize[field.toLowerCase()];
            if (value !== undefined && value !== null && value !== '') {
                return String(value);
            }
        }
        return null;
    };

    const result = {
        name: findValue(nameFields),
        email: findValue(emailFields),
        phone: findValue(phoneFields),
        company: findValue(companyFields),
        message: findValue(messageFields),
        _debug_source: Object.keys(elementorData).length > 0 ? 'elementor' : 'raw'
    };

    return result;
}

// TEST CASES
console.log("--- TEST CASES ---");

const cases = [
    { label: "Lowercase keys (Standard)", input: { nome: "João", telefone: "123" } },
    { label: "Capitalized keys (Variant)", input: { Nome: "Maria", Telefone: "456" } },
    { label: "Uppercase keys", input: { NOME: "Carlos", TELEFONE: "789" } },
    { label: "Elementor Standard", input: { "fields[nome][value]": "Ana", "fields[email][value]": "ana@test.com" } },
    { label: "Elementor Capitalized Field", input: { "fields[Nome][value]": "Beto" } }, // This one might actually work due to regex \w+ and then toLowerCase()
    { label: "Mixed Caps", input: { "Nome Completo": "Paulo", "Celular": "999" } } // Space handling?
];

cases.forEach(c => {
    const res = normalizeLeadData(c.input);
    console.log(`\nCase: ${c.label}`);
    console.log(`Input:`, JSON.stringify(c.input));
    console.log(`Result:`, JSON.stringify(res));
    if (!res.name) console.error("❌ FAILED to capture NAME");
    else console.log("✅ Name captured");
});
