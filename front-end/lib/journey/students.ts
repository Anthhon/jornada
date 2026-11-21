import type { Student } from "@/features/students";

/** Regra da matrícula: exatamente 6 dígitos (a mesma do back-end). */
export const REGISTRATION_PATTERN = /^\d{6}$/;

export function validateRegistration(registration: string, students: Student[], currentId?: string) {
  const value = registration.trim();
  if (!value) return "Informe a matrícula.";
  if (!REGISTRATION_PATTERN.test(value)) return "A matrícula deve ter exatamente 6 dígitos.";
  if (students.some((student) => student.registration === value && student.id !== currentId)) return "Esta matrícula já existe.";
  return undefined;
}
