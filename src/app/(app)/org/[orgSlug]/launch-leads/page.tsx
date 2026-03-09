import { redirect } from "next/navigation";

export default function LaunchLeadsRedirectPage({ params }: { params: { orgSlug: string } }) {
    redirect(`/org/${params.orgSlug}/launch-leads/vendas-hotmart`);
}
