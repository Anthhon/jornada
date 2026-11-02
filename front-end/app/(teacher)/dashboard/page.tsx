import { DashboardPage } from "@/features/dashboard";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Salão da Guilda" };

export default function Page() {
  return <DashboardPage />;
}
