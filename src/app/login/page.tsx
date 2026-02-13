import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth-helper";
import { cookies } from "next/headers";

export default async function LoginPage(props: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const searchParams = await props.searchParams;
  const ssoToken = searchParams.sso_token;

  if (ssoToken && typeof ssoToken === 'string') {
    const cookieStore = await cookies();
    cookieStore.set('stack-auth-token', ssoToken, {
      path: '/',
      secure: true,
      sameSite: 'none', // Required for cross-site iframe cookies
      httpOnly: true,
    });
    // Redirect to self without the token to clean up URL and trigger re-auth check
    redirect("/login");
  }

  const user = await getAuthenticatedUser();
  if (user) {
    redirect("/adm/dashboard");
  }

  // If no user and no sso_token, redirect to Stack Auth sign-in
  redirect("/handler/sign-in");
}
