import { z } from "zod";
/**
 * Matrícula do aluno (o formato de 6 dígitos é validado no formulário
 * (`validateRegistration`) e na escrita do mock (`catalog.ts`); o schema de
 * leitura fica tolerante para não derrubar o catálogo inteiro se houver
 * dado antigo salvo no `localStorage`.
 */
export const studentSchema = z.object({ id: z.string().min(1), name: z.string().trim().min(1).max(100), registration: z.string().trim().min(1).max(100) });
