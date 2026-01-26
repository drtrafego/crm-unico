import { LoginForm } from "@/components/auth/login-form";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/adm/dashboard"); // Or wherever the logged-in user should go
  }
  return <LoginForm />;
}
