import { LoginPage } from "@/features/authentication";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Área do professor",
  description: "Acesse a guilda para conduzir missões, grupos e batalhas.",
};

export default function Page() {
  return <LoginPage />;
}
