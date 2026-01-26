import { MainLayout } from "@/components/layout/main-layout";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MainLayout>
      <div className="flex-1 flex flex-col min-h-0 w-full">
        {children}
      </div>
    </MainLayout>
  );
}
