import { MissionDetailsPage } from "@/features/missions";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Detalhes da missão" };

export default function Page() {
  return <MissionDetailsPage />;
}
