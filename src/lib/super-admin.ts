/**
 * Verifica se o email é de um Super Admin.
 * Centraliza a checagem para evitar inconsistencias entre arquivos.
 */
export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.trim().toLowerCase());
}
