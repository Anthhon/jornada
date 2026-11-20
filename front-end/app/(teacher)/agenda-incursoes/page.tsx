import type { Metadata } from "next";
import { TeacherAgenda } from "@/features/public-agenda/components/teacher-agenda";

export const metadata: Metadata = { title: "Agenda de incursões" };

export default function Page() {
  return <TeacherAgenda />;
}
