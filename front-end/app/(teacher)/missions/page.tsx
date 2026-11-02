import { MissionsPage } from "@/features/missions";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Missões" };

export default function Page() {
  return <MissionsPage />;
}
