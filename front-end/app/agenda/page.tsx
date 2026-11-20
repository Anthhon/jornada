import { PublicHeader } from "@/components/landing-page";
import { PublicAgenda } from "@/features/public-agenda";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agenda pública de incursões",
  description: "Consulte aventureiros, grupos, linguagens e datas das incursões.",
};

export default function Page() {
  return (
    <div className="relative z-10 min-h-screen">
      <PublicHeader />
      <main className="guild-agenda-band min-h-screen"><PublicAgenda /></main>
    </div>
  );
}
