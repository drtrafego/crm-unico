import { JWT } from "google-auth-library";
import { google } from "googleapis";

// Singleton to prevent multiple initializations
let authClient: JWT | null = null;

export async function getGoogleSheetsClient() {
    if (authClient) {
        return google.sheets({ version: "v4", auth: authClient });
    }

    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!clientEmail || !privateKey) {
        throw new Error("Credenciais do Google (GOOGLE_SERVICE_ACCOUNT_EMAIL e GOOGLE_PRIVATE_KEY) não configuradas no .env");
    }

    authClient = new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    });

    return google.sheets({ version: "v4", auth: authClient });
}

export async function fetchSheetData(spreadsheetId: string, range: string) {
    try {
        const sheets = await getGoogleSheetsClient();

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });

        return response.data.values;
    } catch (error: unknown) {
        console.error("Erro ao ler dados da planilha do Google:", error);

        // Enhance error message for common issues
        if (error && typeof error === "object" && "code" in error) {
            if (error.code === 403) {
                throw new Error("Acesso Negado (403): O E-mail da Conta de Serviço precisa ter permissão de LEITOR na planilha.");
            }
            if (error.code === 404) {
                throw new Error("Planilha Não Encontrada (404): Verifique se o ID da planilha está correto.");
            }
        }

        throw new Error((error as Error).message || "Erro desconhecido ao acessar a planilha");
    }
}
