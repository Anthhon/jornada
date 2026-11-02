import { QuestionsPage } from "@/features/questions";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Perguntas" };

export default function Page() {
  return <QuestionsPage />;
}
