import { Toaster } from "@/components/ui/sonner";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Debuggers & Developers",
    template: "%s | Debuggers & Developers",
  },
  description:
    "Sistema de incursões gamificadas para dinâmicas de paradigmas de programação.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
