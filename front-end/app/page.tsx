import { LandingPage } from "@/components/landing-page";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Debuggers & Developers — Guilda das Incursões",
  description:
    "Uma jornada entre código e aventura. Consulte a agenda pública de incursões, grupos e linguagens de programação.",
  openGraph: {
    title: "Debuggers & Developers — Guilda das Incursões",
    description:
      "Reúna sua guilda e acompanhe as incursões. Agenda de grupos e missões aberta a todos.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function Home() {
  return <LandingPage />;
}
