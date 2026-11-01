import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jornada | API Console",
  description: "Painel simples para visualizar e testar a API do Jornada.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
