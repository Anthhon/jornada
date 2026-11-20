import { api } from "@/lib/api";
import { studentSchema } from "../schemas/student";
import type { Student } from "@/features/students";

// Provisional MSW contract: adapt this feature's calls to the Django DTO later.
export async function getStudents(signal?: AbortSignal): Promise<Student[]> {
  const { data } = await api.get("/mock-catalog/students/", { signal });
  return studentSchema.array().parse(data);
}

// The current mock uses PUT as upsert; this is not Django's create contract.
export async function saveStudent(item: Student): Promise<Student> {
  const payload = studentSchema.parse(item);
  const { data } = await api.put(`/mock-catalog/students/${encodeURIComponent(payload.id)}/`, payload);
  return studentSchema.parse(data);
}

export async function deleteStudent(id: string): Promise<void> {
  await api.delete(`/mock-catalog/students/${encodeURIComponent(id)}/`);
}

// Preserve existing consumers while keeping HTTP operations explicit above.
export const studentService = { list: getStudents, save: saveStudent, remove: deleteStudent };
