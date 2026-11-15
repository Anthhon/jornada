import { PublicAgenda, PublicHeader } from "@/components/landing-page";
import { Castle } from "@/components/icons/rpg-icons";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Agenda pública de incursões",
  description: "Consulte aventureiros, grupos, linguagens e datas das incursões.",
};

export default function Page() {
  return (
    <div className="relative z-10 min-h-screen">
      <PublicHeader />
      <main className="guild-agenda-band min-h-screen">
        <div className="mx-auto w-full max-w-[1600px] px-5 pt-8 md:px-8 xl:px-10 2xl:px-12">
          <Link href="/" className="guild-cta inline-flex min-h-12 items-center justify-center gap-2 px-6 text-sm font-medium transition-colors">
            <Castle className="h-4 w-4" /> Voltar para a página inicial
          </Link>
        </div>
        <PublicAgenda />
      </main>
    </div>
  );
}
