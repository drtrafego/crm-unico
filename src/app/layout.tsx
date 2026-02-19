
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { StackProvider, StackTheme } from "@stackframe/stack";
import { stackApp } from "@/stack";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CRM Multi-tenant",
  description: "Gerencie seus leads com IA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col h-screen overflow-hidden`}
      >
        <StackProvider app={stackApp}>
          <StackTheme>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
              <div className="w-full bg-slate-950 text-slate-400 text-xs py-1 px-4 border-b border-slate-800 flex justify-center hover:bg-slate-900 transition-colors shrink-0">
                <Link href="/" className="flex items-center gap-2 hover:text-white transition-colors">
                  <ArrowLeft className="w-3 h-3" />
                  Voltar para o Painel Principal
                </Link>
              </div>
              <TooltipProvider>
                <div className="flex-1 min-h-0 relative">
                  {children}
                </div>
                <SpeedInsights />
              </TooltipProvider>
            </ThemeProvider>
          </StackTheme>
        </StackProvider>
      </body>
    </html>
  );
}

