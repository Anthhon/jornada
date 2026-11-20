import { api } from "@/lib/api";
import { questionSchema } from "../schemas/question";
import type { Question } from "@/features/questions";

// Provisional MSW contract: adapt this feature's calls to the Django DTO later.
export async function getQuestions(signal?: AbortSignal): Promise<Question[]> {
  const { data } = await api.get("/mock-catalog/questions/", { signal });
  return questionSchema.array().parse(data);
}

// The current mock uses PUT as upsert; this is not Django's create contract.
export async function saveQuestion(item: Question): Promise<Question> {
  const payload = questionSchema.parse(item);
  const { data } = await api.put(`/mock-catalog/questions/${encodeURIComponent(payload.id)}/`, payload);
  return questionSchema.parse(data);
}

export async function deleteQuestion(id: string): Promise<void> {
  await api.delete(`/mock-catalog/questions/${encodeURIComponent(id)}/`);
}

// Preserve existing consumers while keeping HTTP operations explicit above.
export const questionService = { list: getQuestions, save: saveQuestion, remove: deleteQuestion };
