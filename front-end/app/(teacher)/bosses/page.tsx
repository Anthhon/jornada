import { BossesPage } from "@/features/bosses";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Chefes" };

export default function Page() {
  return <BossesPage />;
}
