import { HeroesPage } from "@/features/heroes";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Heróis" };

export default function Page() {
  return <HeroesPage />;
}
