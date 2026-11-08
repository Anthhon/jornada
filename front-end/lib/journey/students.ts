import type { Student } from "@/features/students";

export function validateRegistration(registration: string, students: Student[], currentId?: string) {
  const value = registration.trim();
  if (!value) return "Informe a matrícula.";
  if (students.some((student) => student.registration === value && student.id !== currentId)) return "Esta matrícula já existe.";
  return undefined;
}
