export interface Team {
  id: string;
  name: string;
  letter?: string;
  memberIds: string[];
  /** Pontos extras individuais por aluno */
  extraPoints: Record<string, number>;
}
