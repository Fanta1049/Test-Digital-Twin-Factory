import type { Metadata } from "next";
import "./globals.css";
import { FactoryStoreProvider } from "@/lib/store/factory-store";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "FantaFac MES — Smart Production Assistant & Digital Twin",
  description:
    "Industrial manufacturing operations, packaging line monitoring, maintenance management, quality inspection, and 3D Digital Twin platform.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen font-sans">
        <FactoryStoreProvider>
          <AppShell>{children}</AppShell>
        </FactoryStoreProvider>
      </body>
    </html>
  );
}
