import { TeacherShell } from "@/components/layout/teacher-shell";
import type { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  return <TeacherShell>{children}</TeacherShell>;
}
