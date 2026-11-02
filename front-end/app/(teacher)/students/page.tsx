import { StudentsPage } from "@/features/students";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Aventureiros" };

export default function Page() {
  return <StudentsPage />;
}
